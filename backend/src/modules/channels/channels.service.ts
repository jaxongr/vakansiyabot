import { Injectable, Logger } from '@nestjs/common';
import { Channel, ChannelStatus, ChannelType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { buildCursorPage, CursorPage } from '../../common/pagination/cursor';
import { ChannelsManager } from '../collector/channels.manager';
import { CollectorService } from '../collector/collector.service';

/** BigInt'larni JSON'ga chiqarish uchun string'ga aylantiramiz */
function serializeChannel(channel: Channel): Omit<Channel, 'tgId'> & { tgId: string } {
  return { ...channel, tgId: channel.tgId.toString() };
}

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly manager: ChannelsManager,
    private readonly collector: CollectorService,
  ) {}

  async create(usernameRaw: string) {
    const username = usernameRaw.replace(/^@/, '');

    const existing = await this.prisma.channel.findFirst({
      where: { username: { equals: username, mode: 'insensitive' }, deletedAt: null },
    });
    if (existing) {
      throw AppException.conflict(
        ErrorCode.CHANNEL_ALREADY_MONITORED,
        `"@${username}" allaqachon kuzatilmoqda`,
      );
    }

    let data: Prisma.ChannelCreateInput;
    if (this.manager.isReady) {
      const info = await this.manager.join(username); // E4003/E4004 ichkarida
      data = {
        tgId: info.tgId,
        username: info.username ?? username,
        title: info.title,
        type: info.isGroup ? ChannelType.GROUP : ChannelType.CHANNEL,
        status: ChannelStatus.ACTIVE,
      };
    } else {
      // Demo rejim: session yo'q — kanal yozuvi saqlanadi, join keyinroq
      this.logger.warn(`Collector disabled — "@${username}" demo rejimda saqlanmoqda`);
      data = {
        tgId: BigInt(Date.now()) * -1n, // vaqtinchalik pseudo-id, join'da yangilanadi
        username,
        title: `@${username}`,
        type: ChannelType.CHANNEL,
        status: ChannelStatus.ACTIVE,
      };
    }

    // soft-deleted yozuv bo'lsa qayta tiklaymiz
    const channel = await this.prisma.channel.upsert({
      where: { tgId: data.tgId as bigint },
      update: { ...data, deletedAt: null },
      create: data,
    });

    await this.collector.refreshActiveChannels();
    return serializeChannel(channel);
  }

  async list(cursor?: string, limit = 20): Promise<CursorPage<ReturnType<typeof serializeChannel>>> {
    const rows = await this.prisma.channel.findMany({
      where: { deletedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const page = buildCursorPage(rows, limit);
    return { data: page.data.map(serializeChannel), meta: page.meta };
  }

  async update(id: string, status: ChannelStatus) {
    const channel = await this.findOrThrow(id);
    const updated = await this.prisma.channel.update({
      where: { id: channel.id },
      data: { status },
    });
    await this.collector.refreshActiveChannels();
    return serializeChannel(updated);
  }

  async remove(id: string): Promise<void> {
    const channel = await this.findOrThrow(id);
    await this.prisma.channel.update({
      where: { id: channel.id },
      data: { deletedAt: new Date(), status: ChannelStatus.PAUSED },
    });
    await this.collector.refreshActiveChannels();
    await this.manager.leave(channel.tgId);
  }

  private async findOrThrow(id: string): Promise<Channel> {
    const channel = await this.prisma.channel.findFirst({ where: { id, deletedAt: null } });
    if (!channel) throw AppException.notFound('Kanal topilmadi');
    return channel;
  }
}
