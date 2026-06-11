import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Bot, Context } from 'grammy';
import { PrismaService } from '../../prisma/prisma.service';
import { SystemStatusService } from '../system/system-status.service';
import { parseAdminIds } from '../../config/configuration';
import { TopicsService } from './topics.service';
import { ANALYZE_QUEUE, DEDUP_QUEUE, PUBLISH_QUEUE } from '../../queues/queue.types';

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BotService.name);
  private bot: Bot | null = null;
  private adminIds: number[] = [];
  private groupId: number | null = null;
  private botUsername = '';

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly status: SystemStatusService,
    private readonly topics: TopicsService,
    @InjectQueue(ANALYZE_QUEUE) private readonly analyzeQueue: Queue,
    @InjectQueue(DEDUP_QUEUE) private readonly dedupQueue: Queue,
    @InjectQueue(PUBLISH_QUEUE) private readonly publishQueue: Queue,
  ) {}

  get instance(): Bot | null {
    return this.bot;
  }

  get username(): string {
    return this.botUsername;
  }

  get publishGroupId(): number | null {
    return this.groupId;
  }

  async onModuleInit(): Promise<void> {
    const token = this.config.get<string>('BOT_TOKEN');
    if (!token) {
      this.status.set('publisher', 'DISABLED', "BOT_TOKEN sozlanmagan — publisher o'chiq");
      this.logger.warn('Publisher disabled: BOT_TOKEN missing');
      return;
    }

    this.adminIds = parseAdminIds(this.config.get<string>('ADMIN_TG_IDS', ''));
    const rawGroupId = this.config.get<string>('PUBLISH_GROUP_ID');
    this.groupId = rawGroupId ? Number(rawGroupId) : null;

    try {
      this.bot = new Bot(token);
      const me = await this.bot.api.getMe();
      this.botUsername = this.config.get<string>('BOT_USERNAME') || me.username;
      this.registerCommands();
      this.topics.attach(this.bot, this.groupId);

      await this.verifyGroup();

      // polling fonda — xatolar logga, crash YO'Q
      void this.bot.start({
        onStart: () => this.logger.log(`Bot @${this.botUsername} polling boshladi`),
      });
    } catch (error) {
      this.status.set('publisher', 'DOWN', `Bot ishga tushmadi: ${(error as Error).message}`);
      this.logger.error(`Bot init failed: ${(error as Error).message}`);
      this.bot = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.bot) await this.bot.stop();
  }

  /** Guruh sozlamalarini tekshiradi: supergroup + forum + bot admin (E4005) */
  private async verifyGroup(): Promise<void> {
    if (!this.bot || !this.groupId) {
      this.status.set(
        'publisher',
        'DEGRADED',
        "PUBLISH_GROUP_ID sozlanmagan (E4005) — e'lonlar guruhga joylanmaydi",
      );
      return;
    }

    try {
      const chat = await this.bot.api.getChat(this.groupId);
      if (chat.type !== 'supergroup') {
        this.status.set('publisher', 'DEGRADED', 'Guruh supergroup emas (E4005)');
        return;
      }
      if (!('is_forum' in chat) || !chat.is_forum) {
        this.status.set('publisher', 'DEGRADED', 'Guruhda Topics (forum) yoqilmagan (E4005)');
        return;
      }
      const me = await this.bot.api.getMe();
      const member = await this.bot.api.getChatMember(this.groupId, me.id);
      if (
        member.status !== 'administrator' ||
        !('can_manage_topics' in member) ||
        !member.can_manage_topics
      ) {
        this.status.set(
          'publisher',
          'DEGRADED',
          'Bot admin emas yoki "Manage Topics" huquqi yo`q (E4005)',
        );
        return;
      }
      this.status.set('publisher', 'OK', `Guruh ${this.groupId} tayyor`);
    } catch (error) {
      this.status.set(
        'publisher',
        'DEGRADED',
        `Guruhni tekshirib bo'lmadi (E4005): ${(error as Error).message}`,
      );
    }
  }

  private registerCommands(): void {
    if (!this.bot) return;

    this.bot.command('setup_topics', async (ctx) => {
      if (!this.isAdmin(ctx)) return;
      if (!this.groupId) {
        await ctx.reply('PUBLISH_GROUP_ID sozlanmagan (E4005)');
        return;
      }
      await ctx.reply('Mavzular yaratilmoqda...');
      const result = await this.topics.setupTopics();
      await ctx.reply(
        `✅ Tayyor: ${result.created} ta yangi mavzu, ${result.existing} ta mavjud edi` +
          (result.failed > 0 ? `, ${result.failed} ta xato (E4006)` : ''),
      );
    });

    this.bot.command('status', async (ctx) => {
      if (!this.isAdmin(ctx)) return;
      const all = this.status.all();
      const lastPublished = await this.prisma.publishedPost.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      const [analyzeCount, dedupCount, publishCount] = await Promise.all([
        this.analyzeQueue.getWaitingCount(),
        this.dedupQueue.getWaitingCount(),
        this.publishQueue.getWaitingCount(),
      ]);
      const lines = [
        '📊 <b>Tizim holati</b>',
        ...Object.entries(all).map(([name, c]) => `• ${name}: ${c.status}${c.message ? ` — ${c.message}` : ''}`),
        `• Queue: analyze=${analyzeCount}, dedup=${dedupCount}, publish=${publishCount}`,
        `• Oxirgi publish: ${lastPublished ? lastPublished.createdAt.toISOString() : 'hali yo`q'}`,
      ];
      await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
    });

    this.bot.command('stats', async (ctx) => {
      if (!this.isAdmin(ctx)) return;
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const [rawPosts, vacancies, resumes, published] = await Promise.all([
        this.prisma.rawPost.count({ where: { createdAt: { gte: dayStart } } }),
        this.prisma.vacancy.count({ where: { createdAt: { gte: dayStart } } }),
        this.prisma.resume.count({ where: { createdAt: { gte: dayStart } } }),
        this.prisma.publishedPost.count({ where: { createdAt: { gte: dayStart } } }),
      ]);
      await ctx.reply(
        [
          '📈 <b>Bugungi raqamlar</b>',
          `• Yangi postlar: ${rawPosts}`,
          `• Vakansiyalar: ${vacancies}`,
          `• Rezyumelar: ${resumes}`,
          `• Guruhga joylandi: ${published}`,
        ].join('\n'),
        { parse_mode: 'HTML' },
      );
    });
  }

  private isAdmin(ctx: Context): boolean {
    return ctx.from !== undefined && this.adminIds.includes(ctx.from.id);
  }
}
