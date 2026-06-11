import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { VacanciesService } from './vacancies.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../redis/cache.service';
import { PUBLISH_QUEUE } from '../../queues/queue.types';
import { ErrorCode } from '../../common/errors/error-codes';

describe('VacanciesService', () => {
  let service: VacanciesService;

  const prisma = {
    vacancy: { findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    savedVacancy: { findMany: jest.fn(), create: jest.fn(), deleteMany: jest.fn() },
    $queryRaw: jest.fn(),
  };
  const cache = { get: jest.fn(), set: jest.fn(), del: jest.fn(), delPattern: jest.fn() };
  const publishQueue = { add: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        VacanciesService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cache },
        { provide: getQueueToken(PUBLISH_QUEUE), useValue: publishQueue },
      ],
    }).compile();
    service = moduleRef.get(VacanciesService);
  });

  describe('list', () => {
    it('cache mavjud bo`lsa DB ga bormaydi', async () => {
      cache.get.mockResolvedValue({ data: [], meta: { nextCursor: null, limit: 20 } });
      const res = await service.list({ limit: 20 });
      expect(prisma.vacancy.findMany).not.toHaveBeenCalled();
      expect(res).toBeDefined();
    });

    it('cache bo`sh -> DB so`rov + cache yozadi', async () => {
      cache.get.mockResolvedValue(null);
      prisma.vacancy.findMany.mockResolvedValue([{ id: 'v1' }, { id: 'v2' }]);
      await service.list({ limit: 20, regionId: 'r1' });
      expect(prisma.vacancy.findMany).toHaveBeenCalled();
      expect(cache.set).toHaveBeenCalled();
    });

    it('q (full-text) so`rovda cache ishlatilmaydi, raw SQL', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 'v1' }]);
      prisma.vacancy.findMany.mockResolvedValue([{ id: 'v1', title: 'Oshpaz' }]);
      const res = await service.list({ q: 'oshpaz', limit: 20 });
      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(cache.set).not.toHaveBeenCalled();
      expect((res as { data: unknown[] }).data).toHaveLength(1);
    });

    it('bo`sh q -> bo`sh natija', async () => {
      const res = await service.list({ q: '   ', limit: 20 });
      expect((res as { data: unknown[] }).data).toEqual([]);
    });
  });

  describe('detail', () => {
    it('topilmasa E1003', async () => {
      cache.get.mockResolvedValue(null);
      prisma.vacancy.findFirst.mockResolvedValue(null);
      await expect(service.detail('yoq')).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
    });

    it('manbalarni soddalashtirib qaytaradi', async () => {
      cache.get.mockResolvedValue(null);
      prisma.vacancy.findFirst.mockResolvedValue({
        id: 'v1',
        title: 'Oshpaz',
        sources: [
          {
            rawPost: {
              postedAt: new Date(),
              origin: 'CHANNEL',
              externalUrl: null,
              channel: { title: 'Kanal', username: 'k1' },
            },
          },
        ],
      });
      const res = (await service.detail('v1')) as { sources: { channelTitle: string }[] };
      expect(res.sources[0].channelTitle).toBe('Kanal');
      expect(cache.set).toHaveBeenCalled();
    });
  });

  describe('update (moderatsiya)', () => {
    it('edit -> publish edit job', async () => {
      prisma.vacancy.findFirst.mockResolvedValue({ id: 'v1', regionId: 'r1' });
      prisma.vacancy.update.mockResolvedValue({ id: 'v1', regionId: 'r1' });
      await service.update('v1', { title: 'Yangi' });
      expect(publishQueue.add).toHaveBeenCalledWith('publish', { vacancyId: 'v1', action: 'edit' });
      expect(cache.delPattern).toHaveBeenCalled();
    });

    it('hide (status!=ACTIVE) -> publish delete job', async () => {
      prisma.vacancy.findFirst.mockResolvedValue({ id: 'v1', regionId: 'r1' });
      prisma.vacancy.update.mockResolvedValue({ id: 'v1', regionId: 'r1' });
      await service.update('v1', { status: 'HIDDEN' });
      expect(publishQueue.add).toHaveBeenCalledWith('publish', {
        vacancyId: 'v1',
        action: 'delete',
      });
    });

    it('topilmasa E1003', async () => {
      prisma.vacancy.findFirst.mockResolvedValue(null);
      await expect(service.update('yoq', {})).rejects.toMatchObject({
        code: ErrorCode.NOT_FOUND,
      });
    });
  });

  describe('saved', () => {
    it('save -> create, takror P2002 yutiladi', async () => {
      prisma.vacancy.findFirst.mockResolvedValue({ id: 'v1' });
      prisma.savedVacancy.create.mockRejectedValue({ code: 'P2002' });
      const res = await service.save('u1', 'v1');
      expect(res).toEqual({ saved: true });
    });

    it('save -> vakansiya topilmasa E1003', async () => {
      prisma.vacancy.findFirst.mockResolvedValue(null);
      await expect(service.save('u1', 'yoq')).rejects.toMatchObject({
        code: ErrorCode.NOT_FOUND,
      });
    });

    it('unsave -> deleteMany', async () => {
      prisma.savedVacancy.deleteMany.mockResolvedValue({ count: 1 });
      const res = await service.unsave('u1', 'v1');
      expect(res).toEqual({ saved: false });
    });

    it('savedList -> savedAt bilan map', async () => {
      prisma.savedVacancy.findMany.mockResolvedValue([
        { createdAt: new Date('2026-01-01'), vacancy: { id: 'v1', title: 'X' } },
      ]);
      const res = await service.savedList('u1');
      expect(res[0]).toMatchObject({ id: 'v1' });
      expect(res[0].savedAt).toBeInstanceOf(Date);
    });
  });
});
