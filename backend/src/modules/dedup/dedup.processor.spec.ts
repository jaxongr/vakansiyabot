import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { DedupProcessor } from './dedup.processor';
import { NormalizeService } from './normalize.service';
import { MatcherService } from './matcher.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../redis/cache.service';
import {
  DEAD_LETTER_QUEUE,
  DedupJobData,
  ExtractedVacancy,
  PUBLISH_QUEUE,
} from '../../queues/queue.types';

describe('DedupProcessor', () => {
  let processor: DedupProcessor;
  let matcher: MatcherService;

  const prisma = {
    vacancy: { findMany: jest.fn(), create: jest.fn() },
    vacancySource: { create: jest.fn() },
    resume: { findMany: jest.fn(), create: jest.fn() },
    rawPost: { findUnique: jest.fn() },
    dedupReview: { create: jest.fn() },
    region: { findMany: jest.fn() },
    category: { findMany: jest.fn() },
  };
  const publishQueue = { add: jest.fn() };
  const dlq = { add: jest.fn() };

  const baseExtracted: ExtractedVacancy = {
    kind: 'VACANCY',
    title: 'Oshpaz kerak',
    description: 'Oshpaz kerak! Samarqand restoraniga tajribali. Maosh 5 mln. Tel +998901234567',
    regionCode: 'samarqand',
    categoryCode: 'xizmat',
    salaryMin: 5_000_000,
    currency: 'UZS',
    employmentType: 'FULL_TIME',
    phones: ['998901234567'],
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        DedupProcessor,
        NormalizeService,
        MatcherService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: CacheService,
          useValue: { del: jest.fn(), delPattern: jest.fn(), get: jest.fn(), set: jest.fn() },
        },
        { provide: getQueueToken(PUBLISH_QUEUE), useValue: publishQueue },
        { provide: getQueueToken(DEAD_LETTER_QUEUE), useValue: dlq },
      ],
    }).compile();
    processor = moduleRef.get(DedupProcessor);
    matcher = moduleRef.get(MatcherService);

    prisma.region.findMany.mockResolvedValue([
      { id: 'reg-sam', code: 'samarqand' },
      { id: 'reg-other', code: 'other' },
      { id: 'reg-resumes', code: 'resumes' },
    ]);
    prisma.category.findMany.mockResolvedValue([
      { id: 'cat-xizmat', code: 'xizmat' },
      { id: 'cat-boshqa', code: 'boshqa' },
    ]);
    prisma.rawPost.findUnique.mockResolvedValue({ postedAt: new Date('2026-06-01') });
  });

  const makeJob = (extracted: ExtractedVacancy, rawPostId = 'raw-1') =>
    ({ data: { rawPostId, extracted } }) as Job<DedupJobData>;

  it('telefon+sarlavha mos kelsa mavjud vakansiyaga birlashtiradi', async () => {
    prisma.vacancy.findMany.mockResolvedValue([
      { id: 'vac-1', title: '💼 Oshpaz kerak!!!', phones: ['998901234567'], simhash: null },
    ]);

    await processor.process(makeJob(baseExtracted));

    expect(prisma.vacancySource.create).toHaveBeenCalledWith({
      data: { vacancyId: 'vac-1', rawPostId: 'raw-1' },
    });
    expect(prisma.vacancy.create).not.toHaveBeenCalled();
    expect(publishQueue.add).not.toHaveBeenCalled();
  });

  it('simhash > 0.92 bo`lsa birlashtiradi', async () => {
    const nearIdentical = baseExtracted.description + ' Shoshiling!';
    prisma.vacancy.findMany.mockResolvedValue([
      {
        id: 'vac-2',
        title: 'Boshqa sarlavha',
        phones: ['998999999999'],
        simhash: matcher.simhash(baseExtracted.description),
      },
    ]);

    await processor.process(makeJob({ ...baseExtracted, description: nearIdentical }));

    expect(prisma.vacancySource.create).toHaveBeenCalled();
    expect(prisma.vacancy.create).not.toHaveBeenCalled();
  });

  it('o`xshashi yo`q bo`lsa yangi vakansiya yaratib publish ga yuboradi', async () => {
    prisma.vacancy.findMany.mockResolvedValue([]);
    prisma.vacancy.create.mockResolvedValue({ id: 'vac-new' });

    await processor.process(makeJob(baseExtracted));

    expect(prisma.vacancy.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          regionId: 'reg-sam',
          categoryId: 'cat-xizmat',
          sources: { create: { rawPostId: 'raw-1' } },
        }),
      }),
    );
    expect(publishQueue.add).toHaveBeenCalledWith('publish', {
      vacancyId: 'vac-new',
      action: 'create',
    });
    expect(prisma.dedupReview.create).not.toHaveBeenCalled();
  });

  it('0.85-0.92 oralig`ida DedupReview yaratadi (publish baribir bo`ladi)', async () => {
    // kulrang zona deterministik bo'lishi uchun similarity stub qilinadi
    jest.spyOn(matcher, 'similarity').mockReturnValue(0.88);

    prisma.vacancy.findMany.mockResolvedValue([
      { id: 'vac-old', title: 'Oshpaz', phones: [], simhash: 'aaaaaaaaaaaaaaaa' },
    ]);
    prisma.vacancy.create.mockResolvedValue({ id: 'vac-gray' });

    await processor.process(makeJob({ ...baseExtracted, phones: [] }));

    expect(prisma.dedupReview.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ vacancyAId: 'vac-old', vacancyBId: 'vac-gray' }),
      }),
    );
    expect(publishQueue.add).toHaveBeenCalled();
  });

  it('RESUME -> Resume yaratib publish ga yuboradi', async () => {
    prisma.resume.findMany.mockResolvedValue([]);
    prisma.resume.create.mockResolvedValue({ id: 'res-1' });

    await processor.process(
      makeJob({
        ...baseExtracted,
        kind: 'RESUME',
        title: 'Haydovchi',
        resume: { fullName: 'Jasur', age: 25, experienceYears: 3 },
      }),
    );

    expect(prisma.resume.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ fullName: 'Jasur', age: 25, origin: 'CHANNEL' }),
      }),
    );
    expect(publishQueue.add).toHaveBeenCalledWith('publish', {
      resumeId: 'res-1',
      action: 'create',
    });
  });

  it('takror rezyume (telefon + simhash) yaratilmaydi', async () => {
    const description = baseExtracted.description;
    prisma.resume.findMany.mockResolvedValue([
      { id: 'res-old', simhash: matcher.simhash(description) },
    ]);

    await processor.process(makeJob({ ...baseExtracted, kind: 'RESUME', description }));

    expect(prisma.resume.create).not.toHaveBeenCalled();
    expect(publishQueue.add).not.toHaveBeenCalled();
  });
});
