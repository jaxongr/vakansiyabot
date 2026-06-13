import { Injectable } from '@nestjs/common';
import { Bot, Context, InlineKeyboard } from 'grammy';
import { Currency, EmploymentType, PaymentProvider, VacancyStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BillingService, FEATURED_PRICE_UZS, FEATURED_DAYS } from '../billing/billing.service';
import { formatSalary } from '../publisher/templates';
import { MENU_MY_POSTS, MENU_SEARCH_JOB, MENU_SEARCH_RESUME } from './intake.keyboards';

const PAGE_SIZE = 5;

/**
 * Botdan turib mos vakansiya/rezyume qidirish (viloyat -> kategoriya -> sahifalar).
 * Holatsiz — filtrlar callback data ichida ('b:...').
 */
@Injectable()
export class BrowseService {
  private bot: Bot | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
  ) {}

  register(bot: Bot): void {
    this.bot = bot;
    bot.hears(MENU_SEARCH_JOB, (ctx) => this.askRegion(ctx, 'v'));
    bot.hears(MENU_SEARCH_RESUME, (ctx) => this.askRegion(ctx, 'r'));
    bot.hears(MENU_MY_POSTS, (ctx) => this.myPosts(ctx));
    bot.callbackQuery(/^b:/, (ctx) => this.onCallback(ctx));
  }

  /** Ish izlovchi vakansiyaga ariza topshiradi (bot ichidan) */
  private async apply(ctx: Context, vacancyId: string): Promise<void> {
    if (!ctx.from) return;
    const user = await this.prisma.appUser.upsert({
      where: { tgUserId: BigInt(ctx.from.id) },
      update: { username: ctx.from.username, firstName: ctx.from.first_name },
      create: {
        tgUserId: BigInt(ctx.from.id),
        username: ctx.from.username,
        firstName: ctx.from.first_name,
      },
    });
    const vacancy = await this.prisma.vacancy.findFirst({
      where: { id: vacancyId, deletedAt: null, status: VacancyStatus.ACTIVE },
      include: { submittedBy: true },
    });
    if (!vacancy) {
      await ctx.reply("Vakansiya topilmadi yoki yopilgan.");
      return;
    }
    // foydalanuvchining oxirgi rezyumesini biriktiramiz (bo'lsa)
    const resume = await this.prisma.resume.findFirst({
      where: { submittedById: user.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    try {
      await this.prisma.application.create({
        data: {
          vacancyId,
          applicantId: user.id,
          resumeId: resume?.id,
          phone: resume?.phones[0] ?? (ctx.from.username ? null : null),
        },
      });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') {
        await ctx.reply("✅ Siz bu vakansiyaga allaqachon ariza topshirgansiz.");
        return;
      }
      throw e;
    }
    // ish beruvchiga xabar
    if (vacancy.submittedBy?.tgUserId && this.bot) {
      const cnt = await this.prisma.application.count({ where: { vacancyId } });
      await this.bot.api
        .sendMessage(
          Number(vacancy.submittedBy.tgUserId),
          `📩 "<b>${this.esc(vacancy.title)}</b>" e'loningizga yangi ariza! Jami: ${cnt}.\n"💎 E'lonlarim" orqali ko'ring.`,
          { parse_mode: 'HTML' },
        )
        .catch(() => undefined);
    }
    await ctx.reply(
      resume
        ? "✅ Ariza topshirildi! Rezyumeingiz ish beruvchiga yuborildi."
        : "✅ Ariza topshirildi! (Rezyume yuborsangiz, ish beruvchi ko'proq ma'lumot ko'radi — \"📄 Rezyume yuborish\")",
    );
  }

  /** Ish beruvchi: vakansiyaga kelgan arizalarni ko'radi */
  private async viewApplicants(ctx: Context, vacancyId: string): Promise<void> {
    if (!ctx.from) return;
    const user = await this.prisma.appUser.findUnique({
      where: { tgUserId: BigInt(ctx.from.id) },
    });
    const vacancy = await this.prisma.vacancy.findFirst({ where: { id: vacancyId } });
    if (!vacancy || !user || vacancy.submittedById !== user.id) {
      await ctx.reply("Bu e'lon sizniki emas.");
      return;
    }
    const apps = await this.prisma.application.findMany({
      where: { vacancyId },
      include: { applicant: true, resume: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    if (apps.length === 0) {
      await ctx.reply("Hozircha ariza yo'q.");
      return;
    }
    const lines = [`📩 <b>${this.esc(vacancy.title)}</b> — ${apps.length} ariza`, ''];
    for (const a of apps) {
      const name = a.resume?.fullName ?? a.applicant.firstName ?? 'Nomalum';
      const contact =
        a.resume?.phones[0] ? `+${a.resume.phones[0]}` : a.applicant.username ? `@${a.applicant.username}` : '—';
      const exp = a.resume?.experienceYears ? `, ${a.resume.experienceYears} yil tajriba` : '';
      lines.push(`👤 ${this.esc(name)}${exp}\n   📞 ${contact}`);
    }
    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
  }

  /** Foydalanuvchining o'z e'lonlari + "Ko'tarish" tugmasi */
  private async myPosts(ctx: Context): Promise<void> {
    if (ctx.chat?.type !== 'private' || !ctx.from) return;
    const user = await this.prisma.appUser.findUnique({
      where: { tgUserId: BigInt(ctx.from.id) },
    });
    if (!user) {
      await ctx.reply("Sizda hali e'lon yo'q. \"E'lon berish\" orqali qo'shing.");
      return;
    }
    const vacancies = await this.prisma.vacancy.findMany({
      where: { submittedById: user.id, status: VacancyStatus.ACTIVE, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    if (vacancies.length === 0) {
      await ctx.reply("Sizda faol e'lon yo'q. \"E'lon berish\" orqali qo'shing.");
      return;
    }
    await ctx.reply(
      `💎 <b>E'lonlaringiz</b>\n\nKo'tarilgan e'lon ${FEATURED_DAYS} kun davomida ` +
        `ro'yxat va guruh tepasida turadi (${FEATURED_PRICE_UZS.toLocaleString('ru-RU')} so'm).`,
      { parse_mode: 'HTML' },
    );
    for (const v of vacancies) {
      const appCount = await this.prisma.application.count({ where: { vacancyId: v.id } });
      const kb = new InlineKeyboard();
      kb.text(`📩 Arizalar (${appCount})`, `b:apps:${v.id}`);
      if (v.featured) {
        kb.text('⭐ Ko`tarilgan', 'b:noop');
      } else {
        kb.text("💎 Ko'tarish", `b:promo:${v.id}`);
      }
      await ctx.reply(`💼 ${this.esc(v.title)}`, { parse_mode: 'HTML', reply_markup: kb });
    }
  }

  private async promote(ctx: Context, vacancyId: string): Promise<void> {
    if (!ctx.from) return;
    const user = await this.prisma.appUser.findUnique({
      where: { tgUserId: BigInt(ctx.from.id) },
    });
    const checkout = await this.billing.featureVacancyCheckout(
      user?.id ?? null,
      vacancyId,
      PaymentProvider.MANUAL,
    );
    const lines = [
      `💎 <b>E'lonni ko'tarish</b>`,
      `Narx: ${FEATURED_PRICE_UZS.toLocaleString('ru-RU')} so'm / ${FEATURED_DAYS} kun`,
      '',
    ];
    if (checkout.checkoutUrl) {
      lines.push(`To'lov uchun: ${checkout.checkoutUrl}`);
    } else {
      lines.push(checkout.instructions ?? '');
      lines.push('', "To'lov tasdiqlangach e'loningiz avtomatik ko'tariladi.");
    }
    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
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

    if (parts[1] === 'noop') return;
    if (parts[1] === 'promo') {
      await this.promote(ctx, parts[2]);
      return;
    }
    if (parts[1] === 'apply') {
      await this.apply(ctx, parts[2]);
      return;
    }
    if (parts[1] === 'apps') {
      await this.viewApplicants(ctx, parts[2]);
      return;
    }

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
    items.forEach((item, i) => {
      lines.push(`<b>${i + 1}.</b> ${this.renderItem(kind, item)}`);
    });

    const totalPages = Math.ceil(total / PAGE_SIZE);
    const kb = new InlineKeyboard();

    // vakansiyalar uchun har biriga raqamlangan "Ariza" tugmasi
    if (kind === 'v') {
      lines.push("📩 Ariza topshirish uchun raqamni bosing:");
      items.forEach((item, i) => {
        kb.text(`📩 ${i + 1}`, `b:apply:${(item as { id: string }).id}`);
      });
      kb.row();
    }

    if (page > 0) kb.text('⬅️ Oldingi', `b:list:${kind}:${regCode}:${catCode}:${page - 1}`);
    if (page < totalPages - 1)
      kb.text('Keyingi ➡️', `b:list:${kind}:${regCode}:${catCode}:${page + 1}`);

    await ctx
      .editMessageText(lines.join('\n'), { parse_mode: 'HTML', reply_markup: kb })
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
