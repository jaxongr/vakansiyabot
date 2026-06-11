import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Api, TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { NewMessage, NewMessageEvent } from 'telegram/events';
import { ChannelStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NormalizeService } from '../dedup/normalize.service';
import { SystemStatusService } from '../system/system-status.service';
import { ChannelsManager } from './channels.manager';
import { ANALYZE_QUEUE, AnalyzeJobData } from '../../queues/queue.types';

@Injectable()
export class CollectorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CollectorService.name);
  private client: TelegramClient | null = null;
  /** tgId (string) -> channel uuid — faqat ACTIVE kanallar */
  private activeChannels = new Map<string, string>();

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly normalize: NormalizeService,
    private readonly status: SystemStatusService,
    private readonly manager: ChannelsManager,
    @InjectQueue(ANALYZE_QUEUE) private readonly analyzeQueue: Queue<AnalyzeJobData>,
  ) {}

  async onModuleInit(): Promise<void> {
    const apiId = this.config.get<number>('TG_API_ID');
    const apiHash = this.config.get<string>('TG_API_HASH');
    const session = this.config.get<string>('TG_SESSION');

    if (!apiId || !apiHash || !session) {
      this.status.set(
        'collector',
        'DISABLED',
        "TG_API_ID/TG_API_HASH/TG_SESSION sozlanmagan — collector o'chiq (demo rejim)",
      );
      this.logger.warn('Collector disabled: Telegram credentials missing');
      return;
    }

    try {
      this.client = new TelegramClient(new StringSession(session), apiId, apiHash, {
        connectionRetries: 10,
        autoReconnect: true,
      });
      await this.client.connect();

      if (!(await this.client.isUserAuthorized())) {
        this.status.set('collector', 'DOWN', 'TG_SESSION yaroqsiz (E4004)');
        this.logger.error('Collector session invalid');
        this.client = null;
        return;
      }

      await this.refreshActiveChannels();
      this.client.addEventHandler((event) => void this.onNewMessage(event), new NewMessage({}));
      this.manager.setClient(this.client);
      this.status.set('collector', 'OK', `${this.activeChannels.size} ta kanal kuzatilmoqda`);
      this.logger.log(`Collector connected, watching ${this.activeChannels.size} channels`);
    } catch (error) {
      this.status.set('collector', 'DOWN', (error as Error).message);
      this.logger.error(`Collector failed to start: ${(error as Error).message}`);
      this.client = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
    }
  }

  /** Channels CRUD o'zgarganda chaqiriladi */
  async refreshActiveChannels(): Promise<void> {
    const channels = await this.prisma.channel.findMany({
      where: { status: ChannelStatus.ACTIVE, deletedAt: null },
      select: { id: true, tgId: true },
    });
    this.activeChannels = new Map(channels.map((c) => [c.tgId.toString(), c.id]));
    if (this.client) {
      this.status.set('collector', 'OK', `${this.activeChannels.size} ta kanal kuzatilmoqda`);
    }
  }

  /** NewMessage handler — faqat ACTIVE kanallardan RawPost yozadi */
  async onNewMessage(event: NewMessageEvent): Promise<void> {
    try {
      const message = event.message;
      const peer = message.peerId;
      if (!(peer instanceof Api.PeerChannel)) return;

      const tgChannelId = peer.channelId.toString();
      const channelId = this.activeChannels.get(tgChannelId);
      if (!channelId) return;

      const text = message.message;
      if (!text || text.trim().length < 20) return; // juda qisqa — e'lon emas

      const rawPost = await this.saveRawPost(channelId, BigInt(message.id), text, message.date);
      if (rawPost) {
        await this.analyzeQueue.add('analyze', { rawPostId: rawPost.id });
      }
    } catch (error) {
      this.logger.error(`onNewMessage failed: ${(error as Error).message}`);
    }
  }

  /** @@unique([channelId, tgMessageId]) — takror xabar jim o'tkaziladi */
  async saveRawPost(
    channelId: string,
    tgMessageId: bigint,
    text: string,
    messageDate: number,
  ): Promise<{ id: string } | null> {
    try {
      const rawPost = await this.prisma.rawPost.create({
        data: {
          channelId,
          tgMessageId,
          text,
          textHash: this.normalize.hash(text),
          postedAt: new Date(messageDate * 1000),
        },
        select: { id: true },
      });
      await this.prisma.channel.update({
        where: { id: channelId },
        data: { postsCount: { increment: 1 } },
      });
      return rawPost;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'P2002') return null; // dublikat xabar
      throw error;
    }
  }
}
