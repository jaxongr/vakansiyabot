import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHmac, createHash } from 'crypto';
import { Role } from '@prisma/client';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ErrorCode } from '../../common/errors/error-codes';

const BOT_TOKEN = 'test-bot-token';
const ACCESS_SECRET = 'access-secret-xyz';
const REFRESH_SECRET = 'refresh-secret-xyz';

function buildInitData(tgUserId: number, authDate: number): string {
  const params = new URLSearchParams();
  params.set('auth_date', String(authDate));
  params.set('user', JSON.stringify({ id: tgUserId, first_name: 'Test', username: 'tester' }));
  const dcs = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  params.set('hash', createHmac('sha256', secret).update(dcs).digest('hex'));
  return params.toString();
}

function buildWidget(tgUserId: number, authDate: number) {
  const fields: Record<string, string | number> = {
    id: tgUserId,
    first_name: 'Admin',
    username: 'admin',
    auth_date: authDate,
  };
  const dcs = Object.entries(fields).map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = createHash('sha256').update(BOT_TOKEN).digest();
  const hash = createHmac('sha256', secret).update(dcs).digest('hex');
  return { ...fields, hash } as never;
}

describe('AuthService', () => {
  let service: AuthService;
  const jwt = new JwtService();
  const prisma = {
    appUser: { upsert: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
  };
  const config = {
    get: jest.fn((k: string, d?: unknown) => {
      const map: Record<string, string> = {
        BOT_TOKEN,
        ADMIN_TG_IDS: '500,600',
        JWT_ACCESS_SECRET: ACCESS_SECRET,
        JWT_REFRESH_SECRET: REFRESH_SECRET,
      };
      return map[k] ?? d;
    }),
    getOrThrow: jest.fn((k: string) => {
      const map: Record<string, string> = {
        JWT_ACCESS_SECRET: ACCESS_SECRET,
        JWT_REFRESH_SECRET: REFRESH_SECRET,
      };
      return map[k];
    }),
  };

  const now = () => Math.floor(Date.now() / 1000);

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwt,
      config as unknown as ConfigService,
    );
    prisma.appUser.upsert.mockResolvedValue({
      id: 'u1',
      tgUserId: 500n,
      username: 'tester',
      firstName: 'Test',
      regionId: null,
      role: Role.USER,
    });
    prisma.appUser.update.mockResolvedValue({});
  });

  describe('loginWithInitData', () => {
    it('to`g`ri imzo -> token + user', async () => {
      const res = await service.loginWithInitData(buildInitData(500, now()));
      expect(res.accessToken).toBeTruthy();
      expect(res.refreshToken).toBeTruthy();
      expect(res.user.tgUserId).toBe('500');
    });

    it('buzilgan hash -> E4001', async () => {
      const bad = buildInitData(500, now()).replace(/hash=[a-f0-9]+/, 'hash=deadbeef');
      await expect(service.loginWithInitData(bad)).rejects.toMatchObject({
        code: ErrorCode.INVALID_INIT_DATA,
      });
    });

    it('eskirgan auth_date -> E4001', async () => {
      await expect(
        service.loginWithInitData(buildInitData(500, now() - 7200)),
      ).rejects.toMatchObject({ code: ErrorCode.INVALID_INIT_DATA });
    });
  });

  describe('loginWithTelegramWidget', () => {
    it('admin ro`yxatdagi user -> ADMIN token', async () => {
      prisma.appUser.upsert.mockResolvedValue({
        id: 'a1',
        tgUserId: 500n,
        username: 'admin',
        firstName: 'Admin',
        regionId: null,
        role: Role.ADMIN,
      });
      const res = await service.loginWithTelegramWidget(buildWidget(500, now()));
      expect(res.user.role).toBe(Role.ADMIN);
    });

    it('admin emas -> E1002 forbidden', async () => {
      await expect(
        service.loginWithTelegramWidget(buildWidget(999, now())),
      ).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
    });

    it('soxta imzo -> unauthorized', async () => {
      const payload = buildWidget(500, now());
      (payload as { hash: string }).hash = 'soxta';
      await expect(service.loginWithTelegramWidget(payload)).rejects.toMatchObject({
        code: ErrorCode.UNAUTHORIZED,
      });
    });
  });

  describe('refresh rotation', () => {
    it('saqlangan hash mos kelmasa -> bekor qiladi', async () => {
      const token = await jwt.signAsync(
        { sub: 'u1', tgUserId: '500', role: Role.USER },
        { secret: REFRESH_SECRET, expiresIn: '7d' },
      );
      prisma.appUser.findUnique.mockResolvedValue({
        id: 'u1',
        deletedAt: null,
        refreshTokenHash: 'boshqa-hash',
        tgUserId: 500n,
        role: Role.USER,
      });
      await expect(service.refresh(token)).rejects.toMatchObject({
        code: ErrorCode.UNAUTHORIZED,
      });
      expect(prisma.appUser.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { refreshTokenHash: null } }),
      );
    });

    it('yaroqsiz token -> unauthorized', async () => {
      await expect(service.refresh('chala.token')).rejects.toMatchObject({
        code: ErrorCode.UNAUTHORIZED,
      });
    });
  });
});
