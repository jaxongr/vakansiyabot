import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { PostKind } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RulesService } from './rules.service';
import { LlmService } from './llm.service';
import {
  ANALYZE_QUEUE,
  AnalyzeJobData,
  DEAD_LETTER_QUEUE,
  DEDUP_QUEUE,
  DedupJobData,
} from '../../queues/queue.types';

@Injectable()
@Processor(ANALYZE_QUEUE)
export class AnalyzerProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalyzerProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: RulesService,
    private readonly llm: LlmService,
    @InjectQueue(DEDUP_QUEUE) private readonly dedupQueue: Queue<DedupJobData>,
    @InjectQueue(DEAD_LETTER_QUEUE) private readonly dlq: Queue,
  ) {
    super();
  }

  async process(job: Job<AnalyzeJobData>): Promise<void> {
    const rawPost = await this.prisma.rawPost.findUnique({ where: { id: job.data.rawPostId } });
    if (!rawPost || rawPost.processed) return;

    // 1. textHash dublikatmi? -> mavjud vakansiyaga VacancySource qo'shib STOP
    const attached = await this.attachIfKnownHash(rawPost.id, rawPost.textHash);
    if (attached) {
      await this.markProcessed(rawPost.id, PostKind.VACANCY);
      return;
    }

    // 2. rules (regex) tahlili
    const { extracted: draft, needsLlm } = this.rules.analyze(rawPost.text);

    // 3. yetmasa LLM fallback (zod validate, retry ichkarida)
    let extracted = draft;
    if (needsLlm && this.llm.isEnabled) {
      const llmResult = await this.llm.extract(rawPost.text, draft);
      if (llmResult) {
        extracted = llmResult;
      } else if (draft.kind === 'OTHER') {
        // LLM ham aniqlay olmadi — retry/DLQ uchun xato
        throw new Error(`LLM extract failed for rawPost ${rawPost.id}`);
      }
    }

    // 4. e'lon emas (reklama, yangilik) -> STOP
    if (extracted.kind === 'OTHER') {
      await this.markProcessed(rawPost.id, PostKind.OTHER);
      return;
    }

    await this.markProcessed(rawPost.id, extracted.kind as PostKind);
    await this.dedupQueue.add('dedup', { rawPostId: rawPost.id, extracted });
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<AnalyzeJobData> | undefined, error: Error): Promise<void> {
    if (!job) return;
    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade >= maxAttempts) {
      this.logger.error(`Job ${job.id} DLQ ga ko'chirildi: ${error.message}`);
      await this.dlq.add('analyze-failed', {
        queue: ANALYZE_QUEUE,
        data: job.data,
        error: error.message,
        failedAt: new Date().toISOString(),
      });
    }
  }

  private async attachIfKnownHash(rawPostId: string, textHash: string): Promise<boolean> {
    const twin = await this.prisma.rawPost.findFirst({
      where: { textHash, id: { not: rawPostId }, sources: { some: {} } },
      select: { sources: { select: { vacancyId: true }, take: 1 } },
    });
    const vacancyId = twin?.sources[0]?.vacancyId;
    if (!vacancyId) return false;

    try {
      await this.prisma.vacancySource.create({ data: { vacancyId, rawPostId } });
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2002') throw error;
    }
    return true;
  }

  private async markProcessed(id: string, kind: PostKind): Promise<void> {
    await this.prisma.rawPost.update({ where: { id }, data: { processed: true, kind } });
  }
}
