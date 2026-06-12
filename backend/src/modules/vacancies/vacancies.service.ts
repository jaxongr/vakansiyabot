import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma, VacancyStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../redis/cache.service';
import { AppException } from '../../common/errors/app.exception';
import { buildCursorPage } from '../../common/pagination/cursor';
import { ListVacanciesDto } from './dto/list-vacancies.dto';
import { UpdateVacancyDto } from './dto/update-vacancy.dto';
import { PUBLISH_QUEUE, PublishJobData } from '../../queues/queue.types';

const LIST_TTL = 120;
const DETAIL_TTL = 600;

const LIST_SELECT = {
  id: true,
  title: true,
  company: true,
  district: true,
  salaryMin: true,
  salaryMax: true,
  currency: true,
  employmentType: true,
  status: true,
  origin: true,
  featured: true,
  firstSeenAt: true,
  createdAt: true,
  region: { select: { id: true, code: true, nameUz: true } },
  category: { select: { id: true, code: true, nameUz: true } },
} satisfies Prisma.VacancySelect;

@Injectable()
export class VacanciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    @InjectQueue(PUBLISH_QUEUE) private readonly publishQueue: Queue<PublishJobData>,
  ) {}

  async list(dto: ListVacanciesDto) {
    const cacheable = !dto.q && !dto.salaryMin && !dto.employmentType;
    const cacheKey = `vacancies:list:${dto.regionId ?? 'all'}:${dto.categoryId ?? 'all'}:${dto.cursor ?? 'first'}:${dto.limit}`;
    if (cacheable) {
      const cached = await this.cache.get<object>(cacheKey);
      if (cached) return cached;
    }

    const limit = dto.limit ?? 20;
    let result: object;

    if (dto.q) {
      result = await this.fullTextSearch(dto, limit);
    } else {
      const rows = await this.prisma.vacancy.findMany({
        where: this.buildWhere(dto),
        select: LIST_SELECT,
        // featured (promote qilingan) e'lonlar tepada
        orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        ...(dto.cursor ? { cursor: { id: dto.cursor }, skip: 1 } : {}),
      });
      result = buildCursorPage(rows, limit);
    }

    if (cacheable) await this.cache.set(cacheKey, result, LIST_TTL);
    return result;
  }

  private buildWhere(dto: ListVacanciesDto): Prisma.VacancyWhereInput {
    return {
      status: VacancyStatus.ACTIVE,
      deletedAt: null,
      ...(dto.regionId ? { regionId: dto.regionId } : {}),
      ...(dto.categoryId ? { categoryId: dto.categoryId } : {}),
      ...(dto.salaryMin ? { salaryMin: { gte: dto.salaryMin } } : {}),
      ...(dto.employmentType ? { employmentType: dto.employmentType } : {}),
    };
  }

  /** tsvector full-text — search_vector generated column (GIN) */
  private async fullTextSearch(dto: ListVacanciesDto, limit: number) {
    const query = (dto.q ?? '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 6)
      .map((w) => `${w.replace(/[':&|!()]/g, '')}:*`)
      .join(' & ');
    if (!query) return { data: [], meta: { nextCursor: null, limit } };

    const conditions: Prisma.Sql[] = [
      Prisma.sql`v."status" = 'ACTIVE'`,
      Prisma.sql`v."deletedAt" IS NULL`,
      Prisma.sql`v."search_vector" @@ to_tsquery('simple', ${query})`,
    ];
    if (dto.regionId) conditions.push(Prisma.sql`v."regionId" = ${dto.regionId}::uuid`);
    if (dto.categoryId) conditions.push(Prisma.sql`v."categoryId" = ${dto.categoryId}::uuid`);

    const ids = await this.prisma.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT v."id" FROM "vacancies" v
        WHERE ${Prisma.join(conditions, ' AND ')}
        ORDER BY ts_rank(v."search_vector", to_tsquery('simple', ${query})) DESC,
                 v."createdAt" DESC
        LIMIT ${limit + 1}`,
    );

    const rows = await this.prisma.vacancy.findMany({
      where: { id: { in: ids.map((r) => r.id) } },
      select: LIST_SELECT,
    });
    const ordered = ids
      .map(({ id }) => rows.find((r) => r.id === id))
      .filter((r): r is NonNullable<typeof r> => r !== undefined);
    return buildCursorPage(ordered, limit);
  }

  async detail(id: string) {
    const cacheKey = `vacancies:detail:${id}`;
    const cached = await this.cache.get<object>(cacheKey);
    if (cached) return cached;

    const vacancy = await this.prisma.vacancy.findFirst({
      where: { id, deletedAt: null },
      include: {
        region: { select: { id: true, code: true, nameUz: true } },
        category: { select: { id: true, code: true, nameUz: true } },
        sources: {
          select: {
            rawPost: {
              select: {
                postedAt: true,
                origin: true,
                externalUrl: true,
                channel: { select: { title: true, username: true } },
              },
            },
          },
        },
      },
    });
    if (!vacancy) throw AppException.notFound('Vakansiya topilmadi');

    const result = {
      ...vacancy,
      sources: vacancy.sources.map((s) => ({
        origin: s.rawPost.origin,
        channelTitle: s.rawPost.channel?.title ?? 'Tashqi sayt',
        channelUsername: s.rawPost.channel?.username ?? null,
        externalUrl: s.rawPost.externalUrl ?? null,
        postedAt: s.rawPost.postedAt,
      })),
    };
    await this.cache.set(cacheKey, result, DETAIL_TTL);
    return result;
  }

  /** Moderatsiya (ADMIN): edit -> guruh posti yangilanadi, hide -> o'chiriladi */
  async update(id: string, dto: UpdateVacancyDto) {
    const existing = await this.prisma.vacancy.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw AppException.notFound('Vakansiya topilmadi');

    const updated = await this.prisma.vacancy.update({
      where: { id },
      data: dto,
      include: {
        region: { select: { id: true, code: true, nameUz: true } },
        category: { select: { id: true, code: true, nameUz: true } },
      },
    });

    await this.invalidate(id, existing.regionId, updated.regionId);

    if (dto.status && dto.status !== VacancyStatus.ACTIVE) {
      await this.publishQueue.add('publish', { vacancyId: id, action: 'delete' });
    } else {
      await this.publishQueue.add('publish', { vacancyId: id, action: 'edit' });
    }
    return updated;
  }

  async invalidate(id: string, ...regionIds: string[]): Promise<void> {
    await this.cache.del(`vacancies:detail:${id}`, 'stats:overview');
    const unique = [...new Set(regionIds)];
    for (const regionId of unique) {
      await this.cache.delPattern(`vacancies:list:${regionId}:*`);
    }
    await this.cache.delPattern('vacancies:list:all:*');
  }

  // ===================== saved =====================

  async savedList(userId: string) {
    const rows = await this.prisma.savedVacancy.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, vacancy: { select: LIST_SELECT } },
    });
    return rows.map((r) => ({ savedAt: r.createdAt, ...r.vacancy }));
  }

  async save(userId: string, vacancyId: string): Promise<{ saved: boolean }> {
    const vacancy = await this.prisma.vacancy.findFirst({
      where: { id: vacancyId, deletedAt: null },
    });
    if (!vacancy) throw AppException.notFound('Vakansiya topilmadi');
    try {
      await this.prisma.savedVacancy.create({ data: { userId, vacancyId } });
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2002') throw error;
    }
    return { saved: true };
  }

  async unsave(userId: string, vacancyId: string): Promise<{ saved: boolean }> {
    await this.prisma.savedVacancy.deleteMany({ where: { userId, vacancyId } });
    return { saved: false };
  }
}
