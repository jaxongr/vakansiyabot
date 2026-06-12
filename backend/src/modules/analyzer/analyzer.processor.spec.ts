import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AnalyzerProcessor } from './analyzer.processor';
import { RulesService } from './rules.service';
import { LlmService } from './llm.service';
import { DiscoveryService } from './discovery.service';
import { NormalizeService } from '../dedup/normalize.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ANALYZE_QUEUE, DEAD_LETTER_QUEUE, DEDUP_QUEUE } from '../../queues/queue.types';

describe('AnalyzerProcessor (pipeline)', () => {
  let processor: AnalyzerProcessor;

  const prisma = {
    rawPost: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    vacancySource: { create: jest.fn() },
  };
  const dedupQueue = { add: jest.fn() };
  const dlq = { add: jest.fn() };

  const vacancyText =
    'Oshpaz kerak! Samarqand restoraniga. Maosh 5 mln. Tel +998901234567';

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AnalyzerProcessor,
        RulesService,
        NormalizeService,
        LlmService,
        { provide: DiscoveryService, useValue: { harvest: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn() } }, // LLM o'chiq
        { provide: PrismaService, useValue: prisma },
        { provide: getQueueToken(DEDUP_QUEUE), useValue: dedupQueue },
        { provide: getQueueToken(DEAD_LETTER_QUEUE), useValue: dlq },
      ],
    }).compile();
    processor = moduleRef.get(AnalyzerProcessor);
  });

  const makeJob = (rawPostId: string) => ({ data: { rawPostId } }) as Job<{ rawPostId: string }>;

  it('vakansiya postni tahlil qilib dedup queue ga uzatadi', async () => {
    prisma.rawPost.findUnique.mockResolvedValue({
      id: 'raw-1',
      text: vacancyText,
      textHash: 'hash-1',
      processed: false,
    });
    prisma.rawPost.findFirst.mockResolvedValue(null); // textHash dublikat yo'q

    await processor.process(makeJob('raw-1'));

    expect(prisma.rawPost.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { processed: true, kind: 'VACANCY' } }),
    );
    expect(dedupQueue.add).toHaveBeenCalledWith(
      'dedup',
      expect.objectContaining({
        rawPostId: 'raw-1',
        extracted: expect.objectContaining({ kind: 'VACANCY', regionCode: 'samarqand' }),
      }),
    );
  });

  it('textHash dublikat -> VacancySource qo`shib STOP (dedup ga bormaydi)', async () => {
    prisma.rawPost.findUnique.mockResolvedValue({
      id: 'raw-2',
      text: vacancyText,
      textHash: 'hash-1',
      processed: false,
    });
    prisma.rawPost.findFirst.mockResolvedValue({
      sources: [{ vacancyId: 'vac-1' }],
    });

    await processor.process(makeJob('raw-2'));

    expect(prisma.vacancySource.create).toHaveBeenCalledWith({
      data: { vacancyId: 'vac-1', rawPostId: 'raw-2' },
    });
    expect(dedupQueue.add).not.toHaveBeenCalled();
  });

  it('reklama (OTHER) -> processed, pipeline STOP', async () => {
    prisma.rawPost.findUnique.mockResolvedValue({
      id: 'raw-3',
      text: "Kanalimizga obuna bo'ling! Chegirmalar faqat bizda",
      textHash: 'hash-3',
      processed: false,
    });
    prisma.rawPost.findFirst.mockResolvedValue(null);

    await processor.process(makeJob('raw-3'));

    expect(prisma.rawPost.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { processed: true, kind: 'OTHER' } }),
    );
    expect(dedupQueue.add).not.toHaveBeenCalled();
  });

  it('rezyume post RESUME sifatida dedup ga boradi', async () => {
    prisma.rawPost.findUnique.mockResolvedValue({
      id: 'raw-4',
      text: 'Ish izlayapman, 25 yosh, Toshkentda haydovchiman. Tel +998901234567',
      textHash: 'hash-4',
      processed: false,
    });
    prisma.rawPost.findFirst.mockResolvedValue(null);

    await processor.process(makeJob('raw-4'));

    expect(dedupQueue.add).toHaveBeenCalledWith(
      'dedup',
      expect.objectContaining({ extracted: expect.objectContaining({ kind: 'RESUME' }) }),
    );
  });

  it('allaqachon processed bo`lsa hech narsa qilmaydi', async () => {
    prisma.rawPost.findUnique.mockResolvedValue({ id: 'raw-5', processed: true });

    await processor.process(makeJob('raw-5'));

    expect(prisma.rawPost.update).not.toHaveBeenCalled();
    expect(dedupQueue.add).not.toHaveBeenCalled();
  });

  it('oxirgi urinish muvaffaqiyatsiz bo`lsa DLQ ga yozadi', async () => {
    const job = {
      id: 'j1',
      data: { rawPostId: 'raw-6' },
      attemptsMade: 3,
      opts: { attempts: 3 },
    } as Job<{ rawPostId: string }>;

    await processor.onFailed(job, new Error('boom'));

    expect(dlq.add).toHaveBeenCalledWith(
      'analyze-failed',
      expect.objectContaining({ queue: ANALYZE_QUEUE, error: 'boom' }),
    );
  });

  it('hali urinishlar qolgan bo`lsa DLQ ga yozmaydi', async () => {
    const job = {
      id: 'j2',
      data: { rawPostId: 'raw-7' },
      attemptsMade: 1,
      opts: { attempts: 3 },
    } as Job<{ rawPostId: string }>;

    await processor.onFailed(job, new Error('temp'));

    expect(dlq.add).not.toHaveBeenCalled();
  });
});
