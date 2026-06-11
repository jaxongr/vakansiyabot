import { StatsService } from './stats.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../redis/cache.service';
import { SystemStatusService } from '../system/system-status.service';

describe('StatsService', () => {
  let service: StatsService;
  const prisma = {
    $queryRaw: jest.fn(),
    vacancy: { groupBy: jest.fn(), count: jest.fn() },
    vacancySource: { count: jest.fn() },
    resume: { count: jest.fn() },
    region: { findMany: jest.fn() },
    category: { findMany: jest.fn() },
    channel: { findMany: jest.fn() },
    rawPost: { groupBy: jest.fn() },
  };
  const cache = { get: jest.fn(), set: jest.fn() };
  const status = new SystemStatusService();

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StatsService(
      prisma as unknown as PrismaService,
      cache as unknown as CacheService,
      status,
    );
  });

  describe('overview', () => {
    it('cache mavjud -> DB ga bormaydi', async () => {
      cache.get.mockResolvedValue({ totals: { vacancies: 5 } });
      const res = (await service.overview()) as { totals: { vacancies: number } };
      expect(res.totals.vacancies).toBe(5);
      expect(prisma.vacancy.count).not.toHaveBeenCalled();
    });

    it('dublikat % hisoblaydi (sources > vacancies)', async () => {
      cache.get.mockResolvedValue(null);
      prisma.$queryRaw.mockResolvedValue([{ day: new Date(), count: 3n }]);
      prisma.vacancy.groupBy
        .mockResolvedValueOnce([{ regionId: 'r1', _count: { _all: 4 } }])
        .mockResolvedValueOnce([{ categoryId: 'c1', _count: { _all: 4 } }]);
      prisma.vacancy.count.mockResolvedValue(8);
      prisma.vacancySource.count.mockResolvedValue(10); // 10 manba, 8 vakansiya -> 20% dublikat
      prisma.resume.count.mockResolvedValue(2);
      prisma.region.findMany.mockResolvedValue([{ id: 'r1', nameUz: 'Samarqand' }]);
      prisma.category.findMany.mockResolvedValue([{ id: 'c1', nameUz: 'IT' }]);

      const res = (await service.overview()) as {
        totals: { duplicatePercent: number };
        byRegion: { name: string }[];
      };

      expect(res.totals.duplicatePercent).toBe(20);
      expect(res.byRegion[0].name).toBe('Samarqand');
      expect(cache.set).toHaveBeenCalledWith('stats:overview', expect.anything(), expect.any(Number));
    });
  });

  describe('channels', () => {
    it('kanal bo`yicha post turlarini agregatlaydi', async () => {
      prisma.channel.findMany.mockResolvedValue([
        { id: 'ch1', title: 'Kanal', username: 'k1', status: 'ACTIVE', postsCount: 10 },
      ]);
      prisma.rawPost.groupBy.mockResolvedValue([
        { channelId: 'ch1', kind: 'VACANCY', _count: { _all: 6 } },
        { channelId: 'ch1', kind: 'RESUME', _count: { _all: 2 } },
        { channelId: 'ch1', kind: 'OTHER', _count: { _all: 2 } },
      ]);

      const res = await service.channels();

      expect(res[0]).toMatchObject({ vacancies: 6, resumes: 2, other: 2, rawPosts: 10 });
    });
  });
});
