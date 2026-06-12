import { Injectable } from '@nestjs/common';
import { Bot, Context, InlineKeyboard } from 'grammy';
import { Currency, EmploymentType, VacancyStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { formatSalary } from '../publisher/templates';
import { MENU_SEARCH_JOB, MENU_SEARCH_RESUME } from './intake.keyboards';

const PAGE_SIZE = 5;

/**
 * Botdan turib mos vakansiya/rezyume qidirish (viloyat -> kategoriya -> sahifalar).
 * Holatsiz — filtrlar callback data ichida ('b:...').
 */
@Injectable()
export class BrowseService {
  constructor(private readonly prisma: PrismaService) {}

  register(bot: Bot): void {
    bot.hears(MENU_SEARCH_JOB, (ctx) => this.askRegion(ctx, 'v'));
    bot.hears(MENU_SEARCH_RESUME, (ctx) => this.askRegion(ctx, 'r'));
    bot.callbackQuery(/^b:/, (ctx) => this.onCallback(ctx));
  }

  private async askRegion(ctx: Context, kind: 'v' | 'r'): Promise<void> {
    if (ctx.chat?.type !== 'private') return;
    const regions = await this.prisma.region.findMany({
      where: kind === 'r' ? { special: false } : { code: { not: 'resumes' } },
      orderBy: { sortOrder: 'asc' },
    });
    const kb = new InlineKeyboard();
    kb.text('🌍 Barchasi', `b:cat:${kind}:all`).row();
    regions.forEach((r, i) => {
      kb.text(r.nameUz, `b:cat:${kind}:${r.code}`);
      if (i % 2 === 1) kb.row();
    });
    await ctx.reply(
      kind === 'v' ? '🔍 Qaysi viloyatda ish qidiryapsiz?' : '👤 Qaysi viloyat rezyumelari?',
      { reply_markup: kb },
    );
  }

  private async onCallback(ctx: Context): Promise<void> {
    const data = ctx.callbackQuery?.data;
    if (!data) return;
    await ctx.answerCallbackQuery().catch(() => undefined);
    const parts = data.split(':'); // b:cat:v:<reg> | b:list:v:<reg>:<cat>:<page>

    if (parts[1] === 'cat') {
      const [, , kind, regCode] = parts;
      const categories = await this.prisma.category.findMany({ orderBy: { sortOrder: 'asc' } });
      const kb = new InlineKeyboard();
      kb.text('📋 Barchasi', `b:list:${kind}:${regCode}:all:0`).row();
      categories.forEach((c, i) => {
        kb.text(c.nameUz, `b:list:${kind}:${regCode}:${c.code}:0`);
        if (i % 2 === 1) kb.row();
      });
      await ctx.editMessageText('📂 Yo`nalishni tanlang:', { reply_markup: kb }).catch(() => undefined);
      return;
    }

    if (parts[1] === 'list') {
      const [, , kind, regCode, catCode, pageStr] = parts;
      await this.showResults(ctx, kind as 'v' | 'r', regCode, catCode, Number(pageStr));
    }
  }

  private async showResults(
    ctx: Context,
    kind: 'v' | 'r',
    regCode: string,
    catCode: string,
    page: number,
  ): Promise<void> {
    const where: Record<string, unknown> = { status: VacancyStatus.ACTIVE, deletedAt: null };
    if (regCode !== 'all') {
      const region = await this.prisma.region.findUnique({ where: { code: regCode } });
      if (region) where.regionId = region.id;
    }
    if (catCode !== 'all') {
      const category = await this.prisma.category.findUnique({ where: { code: catCode } });
      if (category) where.categoryId = category.id;
    }

    const skip = page * PAGE_SIZE;
    const [items, total] =
      kind === 'v'
        ? await Promise.all([
            this.prisma.vacancy.findMany({
              where,
              include: { region: true },
              orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
              skip,
              take: PAGE_SIZE,
            }),
            this.prisma.vacancy.count({ where }),
          ])
        : await Promise.all([
            this.prisma.resume.findMany({
              where,
              include: { region: true },
              orderBy: { createdAt: 'desc' },
              skip,
              take: PAGE_SIZE,
            }),
            this.prisma.resume.count({ where }),
          ]);

    if (total === 0) {
      await ctx
        .editMessageText("😕 Mos natija topilmadi. Boshqa filtr bilan urinib ko'ring.")
        .catch(() => undefined);
      return;
    }

    const lines: string[] = [
      kind === 'v' ? '💼 <b>Vakansiyalar</b>' : '👤 <b>Rezyumelar</b>',
      `Topildi: ${total} ta | Sahifa ${page + 1}/${Math.ceil(total / PAGE_SIZE)}`,
      '',
    ];
    for (const item of items) {
      lines.push(this.renderItem(kind, item));
    }

    const totalPages = Math.ceil(total / PAGE_SIZE);
    const nav = new InlineKeyboard();
    if (page > 0) nav.text('⬅️ Oldingi', `b:list:${kind}:${regCode}:${catCode}:${page - 1}`);
    if (page < totalPages - 1)
      nav.text('Keyingi ➡️', `b:list:${kind}:${regCode}:${catCode}:${page + 1}`);

    await ctx
      .editMessageText(lines.join('\n'), { parse_mode: 'HTML', reply_markup: nav })
      .catch(() => undefined);
  }

  private renderItem(kind: 'v' | 'r', item: Record<string, unknown>): string {
    const region = (item.region as { nameUz: string }).nameUz;
    if (kind === 'v') {
      const salary = formatSalary(
        item.salaryMin as number | null,
        item.salaryMax as number | null,
        item.currency as Currency,
      );
      const empMap: Record<string, string> = {
        FULL_TIME: "To'liq",
        PART_TIME: 'Yarim',
        REMOTE: 'Masofaviy',
        SHIFT: 'Smenali',
      };
      const star = item.featured ? '⭐ ' : '';
      return [
        `${star}💼 <b>${this.esc(item.title as string)}</b>`,
        `📍 ${region} | 💰 ${salary} | 🕘 ${empMap[item.employmentType as EmploymentType] ?? ''}`,
        (item.phones as string[])?.[0] ? `📞 +${(item.phones as string[])[0]}` : '',
        '',
      ]
        .filter(Boolean)
        .join('\n');
    }
    return [
      `👤 <b>${this.esc(item.fullName as string)}</b>${item.age ? `, ${item.age}` : ''}`,
      `🔎 ${this.esc(item.title as string)} | 📍 ${region}`,
      item.experienceYears ? `🛠 ${item.experienceYears} yil tajriba` : '',
      (item.phones as string[])?.[0] ? `📞 +${(item.phones as string[])[0]}` : '',
      '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
