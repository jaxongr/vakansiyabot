import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Currency, EmploymentType, Origin, Prisma, VacancyStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../redis/cache.service';
import { NormalizeService } from './normalize.service';
import { MatcherService } from './matcher.service';
import {
  DEAD_LETTER_QUEUE,
  DEDUP_QUEUE,
  DedupJobData,
  ExtractedVacancy,
  PUBLISH_QUEUE,
  PublishJobData,
} from '../../queues/queue.types';

const MERGE_THRESHOLD = 0.92;
const REVIEW_THRESHOLD = 0.85;
const CANDIDATE_WINDOW_DAYS = 60;
const CANDIDATE_LIMIT = 300;

@Injectable()
@Processor(DEDUP_QUEUE)
export class DedupProcessor extends WorkerHost {
  private readonly logger = new Logger(DedupProcessor.name);
  private regionByCode = new Map<string, string>();
  private categoryByCode = new Map<string, string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly normalize: NormalizeService,
    private readonly matcher: MatcherService,
    @InjectQueue(PUBLISH_QUEUE) private readonly publishQueue: Queue<PublishJobData>,
    @InjectQueue(DEAD_LETTER_QUEUE) private readonly dlq: Queue,
  ) {
    super();
  }

  async process(job: Job<DedupJobData>): Promise<void> {
    const { rawPostId, extracted } = job.data;
    if (extracted.kind === 'RESUME') {
      await this.processResume(rawPostId, extracted);
    } else {
      await this.processVacancy(rawPostId, extracted);
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<DedupJobData> | undefined, error: Error): Promise<void> {
    if (!job) return;
    if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
      this.logger.error(`Dedup job ${job.id} DLQ: ${error.message}`);
      await this.dlq.add('dedup-failed', {
        queue: DEDUP_QUEUE,
        data: job.data,
        error: error.message,
        failedAt: new Date().toISOString(),
      });
    }
  }

  // ===================== VACANCY =====================

  private async processVacancy(rawPostId: string, extracted: ExtractedVacancy): Promise<void> {
    const simhash = this.matcher.simhash(extracted.description);
    const phones = extracted.phones.map((p) => this.normalize.normalizePhone(p));
    const regionId = await this.regionId(extracted.regionCode);

    const candidates = await this.findCandidates(regionId, phones);

    // 1. phone + title match -> birlashtirish
    for (const candidate of candidates) {
      if (
        this.matcher.phoneTitleMatch(candidate.phones, candidate.title, phones, extracted.title)
      ) {
        await this.mergeIntoVacancy(candidate.id, rawPostId);
        return;
      }
    }

    // 2. simhash taqqoslash
    let reviewCandidate: { id: string; similarity: number } | null = null;
    for (const candidate of candidates) {
      if (!candidate.simhash) continue;
      const similarity = this.matcher.similarity(candidate.simhash, simhash);
      if (similarity > MERGE_THRESHOLD) {
        await this.mergeIntoVacancy(candidate.id, rawPostId);
        return;
      }
      if (similarity >= REVIEW_THRESHOLD) {
        if (!reviewCandidate || similarity > reviewCandidate.similarity) {
          reviewCandidate = { id: candidate.id, similarity };
        }
      }
    }

    // 3. yangi vakansiya (shubhali bo'lsa DedupReview bilan)
    const vacancy = await this.createVacancy(rawPostId, extracted, simhash, phones, regionId);

    if (reviewCandidate) {
      await this.prisma.dedupReview.create({
        data: {
          vacancyAId: reviewCandidate.id,
          vacancyBId: vacancy.id,
          similarity: reviewCandidate.similarity,
        },
      });
    }

    // yangi vakansiya -> ro'yxat va statistika cache'i eskirdi
    await this.cache.delPattern(`vacancies:list:${regionId}:*`);
    await this.cache.delPattern('vacancies:list:all:*');
    await this.cache.del('stats:overview');

    await this.publishQueue.add('publish', { vacancyId: vacancy.id, action: 'create' });
  }

  private async findCandidates(regionId: string, phones: string[]) {
    const since = new Date(Date.now() - CANDIDATE_WINDOW_DAYS * 24 * 3600 * 1000);
    const or: Prisma.VacancyWhereInput[] = [{ regionId }];
    if (phones.length > 0) or.push({ phones: { hasSome: phones } });

    return this.prisma.vacancy.findMany({
      where: {
        status: VacancyStatus.ACTIVE,
        deletedAt: null,
        createdAt: { gte: since },
        OR: or,
      },
      select: { id: true, title: true, phones: true, simhash: true },
      orderBy: { createdAt: 'desc' },
      take: CANDIDATE_LIMIT,
    });
  }

  private async mergeIntoVacancy(vacancyId: string, rawPostId: string): Promise<void> {
    try {
      await this.prisma.vacancySource.create({ data: { vacancyId, rawPostId } });
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2002') throw error;
    }
  }

  private async createVacancy(
    rawPostId: string,
    extracted: ExtractedVacancy,
    simhash: string,
    phones: string[],
    regionId: string,
  ) {
    const rawPost = await this.prisma.rawPost.findUnique({
      where: { id: rawPostId },
      select: { postedAt: true },
    });

    return this.prisma.vacancy.create({
      data: {
        title: extracted.title,
        description: extracted.description,
        company: extracted.company,
        regionId,
        district: extracted.district,
        categoryId: await this.categoryId(extracted.categoryCode),
        salaryMin: extracted.salaryMin,
        salaryMax: extracted.salaryMax,
        currency: extracted.currency as Currency,
        employmentType: extracted.employmentType as EmploymentType,
        phones,
        tgContact: extracted.tgContact,
        origin: Origin.CHANNEL,
        simhash,
        firstSeenAt: rawPost?.postedAt ?? new Date(),
        sources: { create: { rawPostId } },
      },
      select: { id: true },
    });
  }

  // ===================== RESUME =====================

  private async processResume(rawPostId: string, extracted: ExtractedVacancy): Promise<void> {
    const simhash = this.matcher.simhash(extracted.description);
    const phones = extracted.phones.map((p) => this.normalize.normalizePhone(p));

    // Oddiy dedup: telefon kesishadi va matn deyarli bir xil -> takror, STOP
    if (phones.length > 0) {
      const existing = await this.prisma.resume.findMany({
        where: { status: VacancyStatus.ACTIVE, deletedAt: null, phones: { hasSome: phones } },
        select: { id: true, simhash: true },
        take: 50,
      });
      for (const candidate of existing) {
        if (
          candidate.simhash &&
          this.matcher.similarity(candidate.simhash, simhash) > MERGE_THRESHOLD
        ) {
          this.logger.debug(`Resume duplicate for rawPost ${rawPostId} — skip`);
          return;
        }
      }
    }

    const rawPost = await this.prisma.rawPost.findUnique({
      where: { id: rawPostId },
      select: { postedAt: true },
    });

    const resume = await this.prisma.resume.create({
      data: {
        fullName: extracted.resume?.fullName ?? 'Ism ko`rsatilmagan',
        age: extracted.resume?.age,
        title: extracted.title,
        about: extracted.description,
        regionId: await this.regionId(extracted.regionCode),
        categoryId: await this.categoryId(extracted.categoryCode),
        experienceYears: extracted.resume?.experienceYears,
        experience: extracted.resume?.experience,
        education: extracted.resume?.education,
        skills: extracted.resume?.skills ?? [],
        salaryExpectation: extracted.resume?.salaryExpectation,
        currency: extracted.currency as Currency,
        phones,
        tgContact: extracted.tgContact,
        origin: Origin.CHANNEL,
        rawPostId,
        simhash,
        firstSeenAt: rawPost?.postedAt ?? new Date(),
      },
      select: { id: true },
    });

    await this.publishQueue.add('publish', { resumeId: resume.id, action: 'create' });
  }

  // ===================== lookup =====================

  private async regionId(code: string): Promise<string> {
    if (this.regionByCode.size === 0) {
      const regions = await this.prisma.region.findMany({ select: { id: true, code: true } });
      this.regionByCode = new Map(regions.map((r) => [r.code, r.id]));
    }
    const id = this.regionByCode.get(code) ?? this.regionByCode.get('other');
    if (!id) throw new Error(`Region topilmadi: ${code} (seed ishga tushganmi?)`);
    return id;
  }

  private async categoryId(code: string): Promise<string> {
    if (this.categoryByCode.size === 0) {
      const categories = await this.prisma.category.findMany({ select: { id: true, code: true } });
      this.categoryByCode = new Map(categories.map((c) => [c.code, c.id]));
    }
    const id = this.categoryByCode.get(code) ?? this.categoryByCode.get('boshqa');
    if (!id) throw new Error(`Kategoriya topilmadi: ${code}`);
    return id;
  }
}
