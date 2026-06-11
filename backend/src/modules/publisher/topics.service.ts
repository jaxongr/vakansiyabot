import { Injectable, Logger } from '@nestjs/common';
import { Bot } from 'grammy';
import { Region } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const TOPIC_CREATE_DELAY_MS = 3_000;

export interface SetupTopicsResult {
  created: number;
  existing: number;
  failed: number;
}

@Injectable()
export class TopicsService {
  private readonly logger = new Logger(TopicsService.name);
  private bot: Bot | null = null;
  private groupId: number | null = null;

  constructor(private readonly prisma: PrismaService) {}

  attach(bot: Bot | null, groupId: number | null): void {
    this.bot = bot;
    this.groupId = groupId;
  }

  /**
   * tgTopicId=null bo'lgan har region uchun forum topic yaratadi.
   * Idempotent: mavjudlarini qayta yaratmaydi. Yaratishlar orasida 3s delay.
   */
  async setupTopics(): Promise<SetupTopicsResult> {
    const result: SetupTopicsResult = { created: 0, existing: 0, failed: 0 };
    if (!this.bot || !this.groupId) return result;

    const regions = await this.prisma.region.findMany({ orderBy: { sortOrder: 'asc' } });

    for (const region of regions) {
      if (region.tgTopicId !== null) {
        result.existing += 1;
        continue;
      }
      try {
        await this.createTopicForRegion(region);
        result.created += 1;
        await this.sleep(TOPIC_CREATE_DELAY_MS);
      } catch (error) {
        result.failed += 1;
        this.logger.error(
          `Topic yaratilmadi (E4006) "${region.nameUz}": ${(error as Error).message}`,
        );
      }
    }
    return result;
  }

  /** Region uchun topic id qaytaradi; yo'q bo'lsa yaratadi */
  async ensureTopic(regionId: string): Promise<number | null> {
    const region = await this.prisma.region.findUnique({ where: { id: regionId } });
    if (!region) return null;
    if (region.tgTopicId !== null) return region.tgTopicId;
    if (!this.bot || !this.groupId) return null;

    const updated = await this.createTopicForRegion(region);
    return updated.tgTopicId;
  }

  /** TOPIC_DELETED xatosida chaqiriladi — keyingi publishda qayta yaratiladi */
  async resetTopic(regionId: string): Promise<void> {
    await this.prisma.region.update({
      where: { id: regionId },
      data: { tgTopicId: null },
    });
    this.logger.warn(`Region ${regionId} topic reset qilindi (TOPIC_DELETED)`);
  }

  private async createTopicForRegion(region: Region): Promise<Region> {
    if (!this.bot || !this.groupId) throw new Error('Bot yoki guruh sozlanmagan');
    const topic = await this.bot.api.createForumTopic(this.groupId, region.nameUz);
    const updated = await this.prisma.region.update({
      where: { id: region.id },
      data: { tgTopicId: topic.message_thread_id },
    });
    this.logger.log(`Topic yaratildi: "${region.nameUz}" -> ${topic.message_thread_id}`);
    return updated;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
