import { Injectable, Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { GrammyError, InlineKeyboard } from 'grammy';
import { PrismaService } from '../../prisma/prisma.service';
import { BotService } from './bot.service';
import { TopicsService } from './topics.service';
import { resumeHtml, vacancyHtml } from './templates';
import { DEAD_LETTER_QUEUE, PUBLISH_QUEUE, PublishJobData } from '../../queues/queue.types';

/** Bot API ~20 msg/min chegara — xavfsiz 18 */
const RATE_LIMIT = { max: 18, duration: 60_000 };

@Injectable()
@Processor(PUBLISH_QUEUE, { limiter: RATE_LIMIT })
export class PublishProcessor extends WorkerHost {
  private readonly logger = new Logger(PublishProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly botService: BotService,
    private readonly topics: TopicsService,
    @InjectQueue(DEAD_LETTER_QUEUE) private readonly dlq: Queue,
  ) {
    super();
  }

  async process(job: Job<PublishJobData>): Promise<void> {
    const { vacancyId, resumeId, action } = job.data;
    if (!this.botService.instance || !this.botService.publishGroupId) {
      this.logger.warn(`Publish skip (${action}): bot/guruh sozlanmagan (E4005)`);
      return;
    }

    if (vacancyId) {
      if (action === 'create') await this.publishVacancy(vacancyId);
      if (action === 'edit') await this.editVacancy(vacancyId);
      if (action === 'delete') await this.deleteVacancy(vacancyId);
    } else if (resumeId) {
      if (action === 'create') await this.publishResume(resumeId);
      if (action === 'delete') await this.deleteResume(resumeId);
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<PublishJobData> | undefined, error: Error): Promise<void> {
    if (!job) return;
    if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
      await this.dlq.add('publish-failed', {
        queue: PUBLISH_QUEUE,
        data: job.data,
        error: error.message,
        failedAt: new Date().toISOString(),
      });
    }
  }

  // ===================== VACANCY =====================

  private async publishVacancy(vacancyId: string): Promise<void> {
    // double-publish himoya: PublishedPost.vacancyId @unique
    const already = await this.prisma.publishedPost.findUnique({ where: { vacancyId } });
    if (already) return;

    const vacancy = await this.prisma.vacancy.findUnique({
      where: { id: vacancyId },
      include: {
        region: true,
        sources: { include: { rawPost: { include: { channel: true } } } },
      },
    });
    if (!vacancy || vacancy.deletedAt || vacancy.status !== 'ACTIVE') return;

    const html = vacancyHtml({
      id: vacancy.id,
      title: vacancy.title,
      description: vacancy.description,
      company: vacancy.company,
      regionName: vacancy.region.nameUz,
      district: vacancy.district,
      salaryMin: vacancy.salaryMin,
      salaryMax: vacancy.salaryMax,
      currency: vacancy.currency,
      employmentType: vacancy.employmentType,
      phones: vacancy.phones,
      tgContact: vacancy.tgContact,
      sourceChannels: [
        ...new Set(
          vacancy.sources.map((s) => s.rawPost.channel?.title ?? 'Tashqi sayt').filter(Boolean),
        ),
      ],
    });

    const message = await this.sendToTopic(vacancy.regionId, html, this.vacancyKeyboard(vacancy.id));
    if (!message) return;

    try {
      await this.prisma.publishedPost.create({
        data: {
          vacancyId,
          tgChatId: BigInt(this.botService.publishGroupId ?? 0),
          tgMessageId: message.messageId,
          tgTopicId: message.topicId,
        },
      });
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2002') throw error;
    }
  }

  private async editVacancy(vacancyId: string): Promise<void> {
    const published = await this.prisma.publishedPost.findUnique({
      where: { vacancyId },
      include: {
        vacancy: {
          include: {
            region: true,
            sources: { include: { rawPost: { include: { channel: true } } } },
          },
        },
      },
    });
    if (!published) return;
    const bot = this.botService.instance;
    if (!bot) return;

    const v = published.vacancy;
    const html = vacancyHtml({
      id: v.id,
      title: v.title,
      description: v.description,
      company: v.company,
      regionName: v.region.nameUz,
      district: v.district,
      salaryMin: v.salaryMin,
      salaryMax: v.salaryMax,
      currency: v.currency,
      employmentType: v.employmentType,
      phones: v.phones,
      tgContact: v.tgContact,
      sourceChannels: [
        ...new Set(v.sources.map((s) => s.rawPost.channel?.title ?? 'Tashqi sayt').filter(Boolean)),
      ],
    });

    try {
      await bot.api.editMessageText(Number(published.tgChatId), published.tgMessageId, html, {
        parse_mode: 'HTML',
        reply_markup: this.vacancyKeyboard(v.id),
      });
    } catch (error) {
      if (this.isNotModified(error)) return;
      throw error;
    }
  }

  private async deleteVacancy(vacancyId: string): Promise<void> {
    const published = await this.prisma.publishedPost.findUnique({ where: { vacancyId } });
    if (!published) return;
    await this.deleteMessage(Number(published.tgChatId), published.tgMessageId);
    await this.prisma.publishedPost.delete({ where: { vacancyId } });
  }

  // ===================== RESUME =====================

  private async publishResume(resumeId: string): Promise<void> {
    const already = await this.prisma.publishedResume.findUnique({ where: { resumeId } });
    if (already) return;

    const resume = await this.prisma.resume.findUnique({
      where: { id: resumeId },
      include: { region: true },
    });
    if (!resume || resume.deletedAt || resume.status !== 'ACTIVE') return;

    const resumesRegion = await this.prisma.region.findUnique({ where: { code: 'resumes' } });
    if (!resumesRegion) return;

    const html = resumeHtml({
      id: resume.id,
      fullName: resume.fullName,
      age: resume.age,
      title: resume.title,
      about: resume.about,
      regionName: resume.region.nameUz,
      experienceYears: resume.experienceYears,
      education: resume.education,
      skills: resume.skills,
      salaryExpectation: resume.salaryExpectation,
      currency: resume.currency,
      phones: resume.phones,
      tgContact: resume.tgContact,
    });

    const message = await this.sendToTopic(
      resumesRegion.id,
      html,
      this.resumeKeyboard(resume.id),
    );
    if (!message) return;

    try {
      await this.prisma.publishedResume.create({
        data: {
          resumeId,
          tgChatId: BigInt(this.botService.publishGroupId ?? 0),
          tgMessageId: message.messageId,
          tgTopicId: message.topicId,
        },
      });
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2002') throw error;
    }
  }

  private async deleteResume(resumeId: string): Promise<void> {
    const published = await this.prisma.publishedResume.findUnique({ where: { resumeId } });
    if (!published) return;
    await this.deleteMessage(Number(published.tgChatId), published.tgMessageId);
    await this.prisma.publishedResume.delete({ where: { resumeId } });
  }

  // ===================== helpers =====================

  /** Topic'ga yuboradi; TOPIC_DELETED bo'lsa qayta yaratib bir marta retry qiladi */
  private async sendToTopic(
    regionId: string,
    html: string,
    keyboard: InlineKeyboard,
  ): Promise<{ messageId: number; topicId: number } | null> {
    const bot = this.botService.instance;
    const groupId = this.botService.publishGroupId;
    if (!bot || !groupId) return null;

    let topicId = await this.topics.ensureTopic(regionId);
    if (topicId === null) {
      this.logger.warn(`Topic yaratib bo'lmadi (region ${regionId}) — publish skip`);
      return null;
    }

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const sent = await bot.api.sendMessage(groupId, html, {
          parse_mode: 'HTML',
          message_thread_id: topicId,
          reply_markup: keyboard,
          link_preview_options: { is_disabled: true },
        });
        return { messageId: sent.message_id, topicId };
      } catch (error) {
        if (this.isTopicDeleted(error) && attempt === 1) {
          await this.topics.resetTopic(regionId);
          topicId = await this.topics.ensureTopic(regionId);
          if (topicId === null) return null;
          continue;
        }
        if (this.isRateLimited(error) && attempt === 1) {
          const retryAfter = (error as GrammyError).parameters?.retry_after ?? 5;
          await this.sleep(retryAfter * 1000);
          continue;
        }
        throw error;
      }
    }
    return null;
  }

  private vacancyKeyboard(vacancyId: string): InlineKeyboard {
    return new InlineKeyboard().url(
      "🔍 To'liq ko'rish",
      `https://t.me/${this.botService.username}?startapp=vacancy_${vacancyId}`,
    );
  }

  private resumeKeyboard(resumeId: string): InlineKeyboard {
    return new InlineKeyboard().url(
      "🔍 To'liq ko'rish",
      `https://t.me/${this.botService.username}?startapp=resume_${resumeId}`,
    );
  }

  private async deleteMessage(chatId: number, messageId: number): Promise<void> {
    const bot = this.botService.instance;
    if (!bot) return;
    try {
      await bot.api.deleteMessage(chatId, messageId);
    } catch (error) {
      this.logger.warn(`deleteMessage failed: ${(error as Error).message}`);
    }
  }

  private isNotModified(error: unknown): boolean {
    return /message is not modified/i.test((error as GrammyError).description ?? '');
  }

  private isTopicDeleted(error: unknown): boolean {
    const desc = (error as GrammyError).description ?? '';
    return /TOPIC_DELETED|message thread not found/i.test(desc);
  }

  private isRateLimited(error: unknown): boolean {
    return error instanceof GrammyError && error.error_code === 429;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
