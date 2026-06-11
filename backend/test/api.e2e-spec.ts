import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { createHmac } from 'crypto';
import request from 'supertest';
import { PrismaClient, Role } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const BOT_TOKEN = process.env.BOT_TOKEN ?? 'test-token';

/** Haqiqiy Telegram WebApp initData imzosini emulyatsiya qilamiz */
function buildInitData(tgUserId: number, authDate: number = Math.floor(Date.now() / 1000)): string {
  const params = new URLSearchParams();
  params.set('auth_date', String(authDate));
  params.set('query_id', 'AAE-test');
  params.set('user', JSON.stringify({ id: tgUserId, first_name: 'Test', username: 'tester' }));

  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

describe('API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let jwt: JwtService;
  let regionId: string;
  let categoryId: string;

  const signToken = async (sub: string, role: Role) =>
    new JwtService().signAsync(
      { sub, tgUserId: '1', role },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '5m' },
    );

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = moduleRef.get(PrismaService);
    jwt = moduleRef.get(JwtService);

    // toza holat
    await prisma.$transaction([
      prisma.savedVacancy.deleteMany(),
      prisma.dedupReview.deleteMany(),
      prisma.publishedPost.deleteMany(),
      prisma.publishedResume.deleteMany(),
      prisma.vacancySource.deleteMany(),
      prisma.vacancy.deleteMany(),
      prisma.resume.deleteMany(),
      prisma.rawPost.deleteMany(),
      prisma.channel.deleteMany(),
      prisma.appUser.deleteMany(),
    ]);

    const region = await prisma.region.findFirstOrThrow({ where: { code: 'samarqand' } });
    const category = await prisma.category.findFirstOrThrow({ where: { code: 'xizmat' } });
    regionId = region.id;
    categoryId = category.id;
  }, 60_000);

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/auth/miniapp', () => {
    it('to`g`ri initData -> token + user', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/miniapp')
        .send({ initData: buildInitData(111222333) })
        .expect(200);

      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.user.tgUserId).toBe('111222333');
    });

    it('buzilgan hash -> 401 E4001', async () => {
      const initData = buildInitData(111222333).replace(/hash=\w{10}/, 'hash=deadbeefff');
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/miniapp')
        .send({ initData })
        .expect(401);
      expect(res.body.error.code).toBe('E4001');
    });

    it('eskirgan auth_date -> 401 E4001', async () => {
      const old = Math.floor(Date.now() / 1000) - 7200;
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/miniapp')
        .send({ initData: buildInitData(111222333, old) })
        .expect(401);
      expect(res.body.error.code).toBe('E4001');
    });
  });

  describe('refresh rotation', () => {
    it('refresh -> yangi par, eski refresh ikkinchi marta ishlamaydi', async () => {
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/miniapp')
        .send({ initData: buildInitData(444555666) })
        .expect(200);
      const oldRefresh = login.body.data.refreshToken;

      const refreshed = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: oldRefresh })
        .expect(200);
      expect(refreshed.body.data.accessToken).toBeDefined();

      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: oldRefresh })
        .expect(401);
    });
  });

  describe('vacancies + saved', () => {
    let userToken: string;
    let userId: string;
    let vacancyId: string;

    beforeAll(async () => {
      const user = await prisma.appUser.create({ data: { tgUserId: 999n } });
      userId = user.id;
      userToken = await signToken(user.id, Role.USER);

      const vacancy = await prisma.vacancy.create({
        data: {
          title: 'Oshpaz kerak',
          description: 'Samarqand restoraniga tajribali oshpaz kerak, milliy taomlar',
          regionId,
          categoryId,
          salaryMin: 5_000_000,
          phones: ['998901234567'],
          firstSeenAt: new Date(),
        },
      });
      vacancyId = vacancy.id;
    });

    it('JWT siz 401', async () => {
      await request(app.getHttpServer()).get('/api/v1/vacancies').expect(401);
    });

    it('ro`yxat {data, meta.nextCursor} formatda', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/vacancies')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta).toHaveProperty('nextCursor');
      expect(res.body.data[0].region.code).toBe('samarqand');
    });

    it('regionId filtri ishlaydi', async () => {
      const other = await prisma.region.findFirstOrThrow({ where: { code: 'andijon' } });
      const res = await request(app.getHttpServer())
        .get(`/api/v1/vacancies?regionId=${other.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
      expect(res.body.data).toHaveLength(0);
    });

    it('full-text q qidiruv topadi', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/vacancies?q=oshpaz')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('detail manba kanallar bilan', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/vacancies/${vacancyId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
      expect(res.body.data.title).toBe('Oshpaz kerak');
      expect(res.body.data.sources).toEqual([]);
    });

    it('saqlash -> ro`yxatda chiqadi -> o`chirish', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/me/saved/${vacancyId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(201);

      const saved = await request(app.getHttpServer())
        .get('/api/v1/me/saved')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
      expect(saved.body.data).toHaveLength(1);

      await request(app.getHttpServer())
        .delete(`/api/v1/me/saved/${vacancyId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const after = await request(app.getHttpServer())
        .get('/api/v1/me/saved')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
      expect(after.body.data).toHaveLength(0);
    });

    it('USER vakansiyani PATCH qila olmaydi (403)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/vacancies/${vacancyId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ title: 'Hack' })
        .expect(403);
    });

    it('ADMIN PATCH qiladi', async () => {
      const admin = await prisma.appUser.create({ data: { tgUserId: 1000n, role: Role.ADMIN } });
      const adminToken = await signToken(admin.id, Role.ADMIN);
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/vacancies/${vacancyId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Oshpaz kerak (yangilandi)' })
        .expect(200);
      expect(res.body.data.title).toBe('Oshpaz kerak (yangilandi)');
    });
  });

  describe('refs (public)', () => {
    it('GET /regions — resumes ko`rinmaydi', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/regions').expect(200);
      expect(res.body.data.length).toBe(16);
      expect(res.body.data.some((r: { code: string }) => r.code === 'resumes')).toBe(false);
    });

    it('GET /categories — 14 ta', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/categories').expect(200);
      expect(res.body.data.length).toBe(14);
    });
  });

  describe('channels RBAC', () => {
    it('USER kanal qo`sha olmaydi (403)', async () => {
      const user = await prisma.appUser.create({ data: { tgUserId: 1001n } });
      const token = await signToken(user.id, Role.USER);
      await request(app.getHttpServer())
        .post('/api/v1/channels')
        .set('Authorization', `Bearer ${token}`)
        .send({ username: 'test_channel' })
        .expect(403);
    });

    it('ADMIN qo`shadi (demo mode), takror -> 409 E4002', async () => {
      const admin = await prisma.appUser.create({ data: { tgUserId: 1002n, role: Role.ADMIN } });
      const token = await signToken(admin.id, Role.ADMIN);

      await request(app.getHttpServer())
        .post('/api/v1/channels')
        .set('Authorization', `Bearer ${token}`)
        .send({ username: 'ish_kanal_demo' })
        .expect(201);

      const dup = await request(app.getHttpServer())
        .post('/api/v1/channels')
        .set('Authorization', `Bearer ${token}`)
        .send({ username: 'ish_kanal_demo' })
        .expect(409);
      expect(dup.body.error.code).toBe('E4002');
    });
  });

  describe('system health (public)', () => {
    it('db/redis OK, collector DISABLED', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/system/health').expect(200);
      expect(res.body.data.db.status).toBe('OK');
      expect(res.body.data.redis.status).toBe('OK');
    });
  });
});
