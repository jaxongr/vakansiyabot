import { Injectable, Logger } from '@nestjs/common';
import { EmploymentType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/errors/app.exception';
import { BotService } from '../publisher/bot.service';
import { formatSalary } from '../publisher/templates';

export interface SaveSearchInput {
  title?: string;
  regionId?: string;
  categoryId?: string;
  salaryMin?: number;
  employmentType?: EmploymentType;
  q?: string;
  notify?: boolean;
}

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bot: BotService,
  ) {}

  // ===================== Foydalanuvchi CRUD =====================

  list(userId: string) {
    return this.prisma.savedSearch.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        // nomlarni ko'rsatish uchun
      },
    });
  }

  async create(userId: string, input: SaveSearchInput) {
    const count = await this.prisma.savedSearch.count({ where: { userId } });
    if (count >= 10) throw AppException.conflict('E1004' as never, 'Maksimal 10 ta saqlangan qidiruv');
    return this.prisma.savedSearch.create({
      data: {
        userId,
        title: input.title,
        regionId: input.regionId,
        categoryId: input.categoryId,
        salaryMin: input.salaryMin,
        employmentType: input.employmentType,
        q: input.q,
        notify: input.notify ?? true,
      },
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.prisma.savedSearch.deleteMany({ where: { id, userId } });
  }

  async toggleNotify(userId: string, id: string, notify: boolean) {
    await this.prisma.savedSearch.updateMany({ where: { id, userId }, data: { notify } });
    return { id, notify };
  }

  // ===================== Yangi vakansiya -> alert =====================

  /**
   * Yangi vakansiya yaratilganda chaqiriladi. Mos saqlangan qidiruvlarni topib
   * egalariga bot orqali xabar yuboradi. Eng ko'pi 200 alert (xavfsizlik).
   */
  async notifyMatching(vacancyId: string): Promise<number> {
    const vacancy = await this.prisma.vacancy.findUnique({
      where: { id: vacancyId },
      include: { region: true, category: true },
    });
    if (!vacancy || !this.bot.instance) return 0;

    // mos kelishi mumkin bo'lgan alertlar: region/category mos yoki bo'sh (umumiy)
    const searches = await this.prisma.savedSearch.findMany({
      where: {
        notify: true,
        AND: [
          { OR: [{ regionId: null }, { regionId: vacancy.regionId }] },
          { OR: [{ categoryId: null }, { categoryId: vacancy.categoryId }] },
        ],
      },
      include: { user: { select: { tgUserId: true } } },
      take: 200,
    });

    let sent = 0;
    for (const s of searches) {
      if (!this.matches(s, vacancy)) continue;
      try {
        await this.bot.instance.api.sendMessage(
          Number(s.user.tgUserId),
          this.alertText(vacancy),
          {
            parse_mode: 'HTML',
            link_preview_options: { is_disabled: true },
          },
        );
        sent += 1;
        await this.prisma.savedSearch.update({
          where: { id: s.id },
          data: { lastNotifiedAt: new Date() },
        });
      } catch (e) {
        this.logger.warn(`Alert yuborilmadi (${s.id}): ${(e as Error).message}`);
      }
    }
    if (sent > 0) this.logger.log(`Vakansiya ${vacancyId} -> ${sent} alert yuborildi`);
    return sent;
  }

  private matches(
    s: { salaryMin: number | null; employmentType: EmploymentType | null; q: string | null },
    v: { salaryMin: number | null; employmentType: EmploymentType; title: string; description: string },
  ): boolean {
    if (s.salaryMin && (!v.salaryMin || v.salaryMin < s.salaryMin)) return false;
    if (s.employmentType && v.employmentType !== s.employmentType) return false;
    if (s.q) {
      const hay = `${v.title} ${v.description}`.toLowerCase();
      const ok = s.q
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .every((w) => hay.includes(w));
      if (!ok) return false;
    }
    return true;
  }

  private alertText(v: {
    id: string;
    title: string;
    salaryMin: number | null;
    salaryMax: number | null;
    currency: 'UZS' | 'USD';
    region: { nameUz: string };
    category: { nameUz: string };
  }): string {
    const botUsername = this.bot.username;
    const link = botUsername
      ? `\n👉 https://t.me/${botUsername}?startapp=vacancy_${v.id}`
      : '';
    return [
      `🔔 <b>Yangi mos vakansiya!</b>`,
      `💼 ${this.esc(v.title)}`,
      `📍 ${v.region.nameUz} | 📂 ${v.category.nameUz}`,
      `💰 ${formatSalary(v.salaryMin, v.salaryMax, v.currency)}`,
      link,
    ].join('\n');
  }

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
