import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Avto-kashfiyot: yig'ilgan postlardagi @mention va t.me havolalardan yangi
 * kanal nomzodlarini topadi. Admin tasdiqlaydi -> kuzatiladigan kanal bo'ladi.
 * Bu manba bazasini qo'lsiz kengaytiradi (75 -> yuzlab kanal).
 */
@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);

  // o'zimizning bot/xizmat handle'larini chiqarib tashlash uchun "shovqin" ro'yxati
  private readonly ignore = new Set([
    'joinchat',
    'addstickers',
    'share',
    'iv',
    'telegram',
    'durov',
  ]);

  constructor(private readonly prisma: PrismaService) {}

  /** Post matnidan kanal username'larini ajratib, nomzodlar jadvaliga yozadi */
  async harvest(text: string, sourceTitle?: string): Promise<void> {
    const usernames = this.extract(text);
    for (const username of usernames) {
      try {
        await this.prisma.discoveredChannel.upsert({
          where: { username },
          update: { mentions: { increment: 1 } },
          create: { username, firstSeenIn: sourceTitle, mentions: 1 },
        });
      } catch {
        // poyga holati — jim o'tamiz
      }
    }
  }

  extract(text: string): string[] {
    const found = new Set<string>();
    // @username
    for (const m of text.matchAll(/@([a-zA-Z][a-zA-Z0-9_]{4,31})/g)) {
      found.add(m[1].toLowerCase());
    }
    // t.me/username yoki telegram.me/username (joinchat/+ invitelarni emas)
    for (const m of text.matchAll(/(?:t\.me|telegram\.me)\/([a-zA-Z][a-zA-Z0-9_]{4,31})/gi)) {
      found.add(m[1].toLowerCase());
    }
    return [...found].filter((u) => !this.ignore.has(u) && !u.endsWith('bot'));
  }

  // ===================== Admin =====================

  async list(status = 'PENDING', limit = 100) {
    return this.prisma.discoveredChannel.findMany({
      where: { status },
      orderBy: [{ mentions: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });
  }

  async setStatus(id: string, status: 'APPROVED' | 'REJECTED'): Promise<{ username: string }> {
    const dc = await this.prisma.discoveredChannel.update({
      where: { id },
      data: { status },
    });
    return { username: dc.username };
  }
}
