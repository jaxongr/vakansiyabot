import { Injectable } from '@nestjs/common';
import { VacancyStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../redis/cache.service';
import { SystemStatusService } from '../system/system-status.service';

const OVERVIEW_TTL = 300;
const DAYS = 14;

@Injectable()
export class StatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly status: SystemStatusService,
  ) {}

  async overview() {
    const cached = await this.cache.get<object>('stats:overview');
    if (cached) return cached;

    const since = new Date();
    since.setDate(since.getDate() - DAYS);
    since.setHours(0, 0, 0, 0);

    const [daily, byRegion, byCategory, totals, sourcesCount, resumesCount] = await Promise.all([
      this.prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
        SELECT date_trunc('day', "createdAt") AS day, count(*) AS count
        FROM "vacancies" WHERE "createdAt" >= ${since} AND "deletedAt" IS NULL
        GROUP BY 1 ORDER BY 1`,
      this.prisma.vacancy.groupBy({
        by: ['regionId'],
        where: { status: VacancyStatus.ACTIVE, deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.vacancy.groupBy({
        by: ['categoryId'],
        where: { status: VacancyStatus.ACTIVE, deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.vacancy.count({ where: { deletedAt: null } }),
      this.prisma.vacancySource.count(),
      this.prisma.resume.count({ where: { deletedAt: null } }),
    ]);

    const [regions, categories] = await Promise.all([
      this.prisma.region.findMany({ select: { id: true, nameUz: true } }),
      this.prisma.category.findMany({ select: { id: true, nameUz: true } }),
    ]);
    const regionName = new Map(regions.map((r) => [r.id, r.nameUz]));
    const categoryName = new Map(categories.map((c) => [c.id, c.nameUz]));

    // dublikat % = birlashtirilgan manbalar ulushi
    const duplicatePercent =
      sourcesCount > 0 ? Math.round(((sourcesCount - totals) / sourcesCount) * 100) : 0;

    const result = {
      daily: daily.map((d) => ({ day: d.day, count: Number(d.count) })),
      byRegion: byRegion.map((r) => ({
        regionId: r.regionId,
        name: regionName.get(r.regionId) ?? '?',
        count: r._count._all,
      })),
      byCategory: byCategory.map((c) => ({
        categoryId: c.categoryId,
        name: categoryName.get(c.categoryId) ?? '?',
        count: c._count._all,
      })),
      totals: {
        vacancies: totals,
        resumes: resumesCount,
        rawSources: sourcesCount,
        duplicatePercent: Math.max(0, duplicatePercent),
      },
      components: this.status.all(),
    };

    await this.cache.set('stats:overview', result, OVERVIEW_TTL);
    return result;
  }

  async channels() {
    const channels = await this.prisma.channel.findMany({
      where: { deletedAt: null },
      select: { id: true, title: true, username: true, status: true, postsCount: true },
      orderBy: { postsCount: 'desc' },
      take: 50,
    });

    const counts = await this.prisma.rawPost.groupBy({
      by: ['channelId', 'kind'],
      _count: { _all: true },
      where: { channelId: { in: channels.map((c) => c.id) } },
    });

    return channels.map((channel) => {
      const mine = counts.filter((c) => c.channelId === channel.id);
      const total = mine.reduce((sum, c) => sum + c._count._all, 0);
      const vacancies = mine.find((c) => c.kind === 'VACANCY')?._count._all ?? 0;
      const resumes = mine.find((c) => c.kind === 'RESUME')?._count._all ?? 0;
      const other = mine.find((c) => c.kind === 'OTHER')?._count._all ?? 0;
      return { ...channel, rawPosts: total, vacancies, resumes, other };
    });
  }
}
