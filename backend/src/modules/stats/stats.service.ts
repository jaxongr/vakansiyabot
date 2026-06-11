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

  /** Mukammal analitika — funnel, manba, ish turi, maosh, kunlik, soatlik */
  async analytics() {
    const cached = await this.cache.get<object>('stats:analytics');
    if (cached) return cached;

    const since = new Date();
    since.setDate(since.getDate() - 30);
    since.setHours(0, 0, 0, 0);

    const [
      rawTotal,
      analyzed,
      vacancyTotal,
      published,
      byOrigin,
      byEmployment,
      byKind,
      dailyVac,
      dailyRes,
      salaryBuckets,
      hourly,
      topChannels,
    ] = await Promise.all([
      this.prisma.rawPost.count(),
      this.prisma.rawPost.count({ where: { processed: true } }),
      this.prisma.vacancy.count({ where: { deletedAt: null } }),
      this.prisma.publishedPost.count(),
      this.prisma.vacancy.groupBy({
        by: ['origin'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.vacancy.groupBy({
        by: ['employmentType'],
        where: { deletedAt: null, status: VacancyStatus.ACTIVE },
        _count: { _all: true },
      }),
      this.prisma.rawPost.groupBy({
        by: ['kind'],
        where: { processed: true },
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
        SELECT date_trunc('day', "createdAt") AS day, count(*) AS count
        FROM "vacancies" WHERE "createdAt" >= ${since} AND "deletedAt" IS NULL
        GROUP BY 1 ORDER BY 1`,
      this.prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
        SELECT date_trunc('day', "createdAt") AS day, count(*) AS count
        FROM "resumes" WHERE "createdAt" >= ${since} AND "deletedAt" IS NULL
        GROUP BY 1 ORDER BY 1`,
      this.prisma.$queryRaw<Array<{ bucket: string; count: bigint }>>`
        SELECT CASE
          WHEN "salaryMin" IS NULL THEN 'Kelishilgan'
          WHEN "currency" = 'USD' THEN 'USD'
          WHEN "salaryMin" < 3000000 THEN '< 3 mln'
          WHEN "salaryMin" < 5000000 THEN '3-5 mln'
          WHEN "salaryMin" < 8000000 THEN '5-8 mln'
          ELSE '8 mln+'
        END AS bucket, count(*) AS count
        FROM "vacancies" WHERE "deletedAt" IS NULL AND "status" = 'ACTIVE'
        GROUP BY 1`,
      this.prisma.$queryRaw<Array<{ hour: number; count: bigint }>>`
        SELECT EXTRACT(HOUR FROM "postedAt")::int AS hour, count(*) AS count
        FROM "raw_posts" WHERE "createdAt" >= ${since}
        GROUP BY 1 ORDER BY 1`,
      this.prisma.channel.findMany({
        where: { deletedAt: null },
        select: { title: true, postsCount: true },
        orderBy: { postsCount: 'desc' },
        take: 10,
      }),
    ]);

    // kunlik dual seriya (vacancy + resume) bitta o'qda
    const dayMap = new Map<string, { day: string; vacancies: number; resumes: number }>();
    const key = (d: Date) => d.toISOString().slice(0, 10);
    for (const row of dailyVac) {
      const k = key(row.day);
      dayMap.set(k, { day: k, vacancies: Number(row.count), resumes: 0 });
    }
    for (const row of dailyRes) {
      const k = key(row.day);
      const ex = dayMap.get(k) ?? { day: k, vacancies: 0, resumes: 0 };
      ex.resumes = Number(row.count);
      dayMap.set(k, ex);
    }

    const result = {
      funnel: [
        { stage: 'Manba postlar', count: rawTotal },
        { stage: 'Tahlil qilindi', count: analyzed },
        { stage: 'Vakansiya', count: vacancyTotal },
        { stage: 'Guruhga joylandi', count: published },
      ],
      byOrigin: byOrigin.map((o) => ({ origin: o.origin, count: o._count._all })),
      byEmployment: byEmployment.map((e) => ({ type: e.employmentType, count: e._count._all })),
      byKind: byKind.map((k) => ({ kind: k.kind ?? 'NONE', count: k._count._all })),
      daily: [...dayMap.values()].sort((a, b) => a.day.localeCompare(b.day)),
      salaryBuckets: salaryBuckets.map((s) => ({ bucket: s.bucket, count: Number(s.count) })),
      hourly: hourly.map((h) => ({ hour: h.hour, count: Number(h.count) })),
      topChannels: topChannels.map((c) => ({ title: c.title, posts: c.postsCount })),
    };

    await this.cache.set('stats:analytics', result, OVERVIEW_TTL);
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
