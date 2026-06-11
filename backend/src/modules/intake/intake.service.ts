import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Bot, Context } from 'grammy';
import { Currency, EmploymentType, Origin } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RulesService } from '../analyzer/rules.service';
import { IntakeDraft, IntakeState, IntakeStateService } from './intake-state.service';
import {
  MENU_HELP,
  MENU_RESUME,
  MENU_VACANCY,
  cancelKeyboard,
  categoriesKeyboard,
  confirmKeyboard,
  employmentKeyboard,
  mainMenu,
  regionsKeyboard,
  skipKeyboard,
} from './intake.keyboards';
import { resumeHtml, vacancyHtml } from '../publisher/templates';
import { PUBLISH_QUEUE, PublishJobData } from '../../queues/queue.types';

const VACANCY_STEPS = [
  'title',
  'company',
  'region',
  'category',
  'salary',
  'employment',
  'description',
  'phone',
  'confirm',
] as const;

const RESUME_STEPS = [
  'fullName',
  'age',
  'title',
  'region',
  'category',
  'experience',
  'skills',
  'education',
  'salaryExpectation',
  'phone',
  'about',
  'confirm',
] as const;

@Injectable()
export class IntakeService {
  private readonly logger = new Logger(IntakeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly state: IntakeStateService,
    private readonly rules: RulesService,
    @InjectQueue(PUBLISH_QUEUE) private readonly publishQueue: Queue<PublishJobData>,
  ) {}

  /** BotService onModuleInit da chaqiradi */
  register(bot: Bot): void {
    bot.command('start', (ctx) => this.onStart(ctx));
    bot.command('cancel', (ctx) => this.onCancel(ctx));
    bot.on('callback_query:data', (ctx) => this.onCallback(ctx));
    bot.on('message:text', (ctx) => this.onText(ctx));
  }

  // ===================== entry =====================

  private async onStart(ctx: Context): Promise<void> {
    if (ctx.chat?.type !== 'private') return;
    await ctx.reply(
      [
        "👋 <b>Vakansiya botiga xush kelibsiz!</b>",
        '',
        "• Ish beruvchi bo'lsangiz — e'lon bering, u tegishli viloyat mavzusiga joylanadi.",
        "• Ish izlayotgan bo'lsangiz — rezyume yuboring, ish beruvchilar ko'radi.",
        '',
        'Quyidagi menyudan tanlang 👇',
      ].join('\n'),
      { parse_mode: 'HTML', reply_markup: mainMenu() },
    );
  }

  private async onCancel(ctx: Context): Promise<void> {
    if (!ctx.from) return;
    await this.state.clear(ctx.from.id);
    await ctx.reply('Bekor qilindi. Menyudan qayta tanlashingiz mumkin 👇', {
      reply_markup: mainMenu(),
    });
  }

  // ===================== text router =====================

  private async onText(ctx: Context): Promise<void> {
    if (ctx.chat?.type !== 'private' || !ctx.from || !ctx.message?.text) return;
    const text = ctx.message.text.trim();

    if (text === MENU_VACANCY) {
      await this.state.set(ctx.from.id, { flow: 'vacancy', step: 'title', draft: {} });
      await ctx.reply('💼 Lavozim nomini yozing (masalan: <b>Oshpaz kerak</b>):', {
        parse_mode: 'HTML',
        reply_markup: cancelKeyboard(),
      });
      return;
    }
    if (text === MENU_RESUME) {
      await this.state.set(ctx.from.id, { flow: 'resume', step: 'fullName', draft: {} });
      await ctx.reply('👤 Ism-familiyangizni yozing:', { reply_markup: cancelKeyboard() });
      return;
    }
    if (text === MENU_HELP) {
      await ctx.reply(
        [
          'ℹ️ <b>Yordam</b>',
          '',
          "➕ E'lon berish — savollarga javob berasiz, e'lon guruhdagi viloyatingiz mavzusiga joylanadi.",
          "📄 Rezyume — o'zingiz haqida ma'lumot kiritasiz, rezyume alohida mavzuga joylanadi.",
          '',
          '/cancel — jarayonni bekor qilish',
        ].join('\n'),
        { parse_mode: 'HTML' },
      );
      return;
    }

    const state = await this.state.get(ctx.from.id);
    if (!state) return; // wizard tashqarisidagi matn

    await this.handleStepInput(ctx, state, text);
  }

  // ===================== callback router =====================

  private async onCallback(ctx: Context): Promise<void> {
    if (!ctx.from || !ctx.callbackQuery?.data) return;
    const data = ctx.callbackQuery.data;
    if (!data.startsWith('int:')) return;
    await ctx.answerCallbackQuery().catch(() => undefined);

    if (data === 'int:cancel') {
      await this.state.clear(ctx.from.id);
      await ctx.reply('Bekor qilindi 👌', { reply_markup: mainMenu() });
      return;
    }

    const state = await this.state.get(ctx.from.id);
    if (!state) return;

    if (data === 'int:skip') {
      await this.advance(ctx, state);
      return;
    }
    if (data === 'int:ok' && state.step === 'confirm') {
      await this.save(ctx, state);
      return;
    }

    const [, kind, value] = data.split(':');
    if (kind === 'reg' && state.step === 'region') {
      state.draft.regionCode = value;
      await this.advance(ctx, state);
    } else if (kind === 'cat' && state.step === 'category') {
      state.draft.categoryCode = value;
      await this.advance(ctx, state);
    } else if (kind === 'emp' && state.step === 'employment') {
      state.draft.employmentType = value as IntakeDraft['employmentType'];
      await this.advance(ctx, state);
    }
  }

  // ===================== step machine =====================

  private steps(state: IntakeState): readonly string[] {
    return state.flow === 'vacancy' ? VACANCY_STEPS : RESUME_STEPS;
  }

  private async handleStepInput(ctx: Context, state: IntakeState, text: string): Promise<void> {
    const d = state.draft;
    const fail = async (msg: string) => ctx.reply(msg, { reply_markup: cancelKeyboard() });

    switch (state.step) {
      case 'title':
        if (text.length < 3 || text.length > 100) return void fail('3-100 belgi oralig`ida yozing.');
        d.title = text;
        break;
      case 'company':
        d.company = text === '-' ? undefined : text.slice(0, 100);
        break;
      case 'fullName':
        if (text.length < 3 || text.length > 80) return void fail('Ism-familiya 3-80 belgi.');
        d.fullName = text;
        break;
      case 'age': {
        const age = Number(text);
        if (!Number.isInteger(age) || age < 14 || age > 70)
          return void fail('Yoshingizni raqamda yozing (14-70).');
        d.age = age;
        break;
      }
      case 'salary':
      case 'salaryExpectation': {
        const parsed = this.rules.extractSalary(text.toLowerCase());
        if (state.step === 'salary') {
          d.salaryMin = parsed.min;
          d.salaryMax = parsed.max;
          d.currency = parsed.currency;
        } else {
          d.salaryExpectation = parsed.min;
          d.currency = parsed.currency;
        }
        break;
      }
      case 'experience': {
        const years = Number(text.replace(/\D/g, ''));
        d.experienceYears = Number.isInteger(years) && years >= 0 && years <= 50 ? years : 0;
        break;
      }
      case 'skills':
        d.skills =
          text === '-'
            ? []
            : text
                .split(/[,;\n]/)
                .map((s) => s.trim())
                .filter((s) => s.length > 0)
                .slice(0, 10);
        break;
      case 'education':
        d.education = text === '-' ? undefined : text.slice(0, 200);
        break;
      case 'description':
      case 'about': {
        if (text.length < 20) return void fail('Kamida 20 belgi yozing — batafsil bo`lsin.');
        if (state.step === 'description') d.description = text.slice(0, 3000);
        else d.about = text.slice(0, 3000);
        break;
      }
      case 'phone': {
        const phones = this.rules.extractPhones(text);
        if (phones.length === 0)
          return void fail('Telefon raqamni +998 90 123 45 67 formatda yozing.');
        d.phones = phones;
        break;
      }
      default:
        return; // region/category/employment/confirm — callback orqali
    }

    await this.advance(ctx, state);
  }

  private async advance(ctx: Context, state: IntakeState): Promise<void> {
    if (!ctx.from) return;
    const steps = this.steps(state);
    const idx = steps.indexOf(state.step);
    state.step = steps[idx + 1] ?? 'confirm';
    await this.state.set(ctx.from.id, state);
    await this.prompt(ctx, state);
  }

  /** Har qadm uchun savol yuboradi */
  private async prompt(ctx: Context, state: IntakeState): Promise<void> {
    switch (state.step) {
      case 'company':
        await ctx.reply("🏢 Kompaniya/tashkilot nomi (bo'lmasa «-» yozing):", {
          reply_markup: skipKeyboard(),
        });
        return;
      case 'region': {
        const regions = await this.prisma.region.findMany({
          where: state.flow === 'vacancy' ? { code: { not: 'resumes' } } : { special: false },
          orderBy: { sortOrder: 'asc' },
        });
        await ctx.reply('📍 Viloyatni tanlang:', { reply_markup: regionsKeyboard(regions) });
        return;
      }
      case 'category': {
        const categories = await this.prisma.category.findMany({ orderBy: { sortOrder: 'asc' } });
        await ctx.reply('📂 Yo`nalishni tanlang:', {
          reply_markup: categoriesKeyboard(categories),
        });
        return;
      }
      case 'salary':
        await ctx.reply('💰 Maoshni yozing (masalan: 5 mln, 300$, 3-5 mln, kelishilgan):', {
          reply_markup: cancelKeyboard(),
        });
        return;
      case 'salaryExpectation':
        await ctx.reply('💰 Kutilayotgan maosh (masalan: 5 mln yoki kelishilgan):', {
          reply_markup: cancelKeyboard(),
        });
        return;
      case 'employment':
        await ctx.reply('🕘 Ish turini tanlang:', { reply_markup: employmentKeyboard() });
        return;
      case 'description':
        await ctx.reply(
          "📝 E'lon matnini batafsil yozing (talablar, sharoit, ish vaqti...):",
          { reply_markup: cancelKeyboard() },
        );
        return;
      case 'age':
        await ctx.reply('🎂 Yoshingiz:', { reply_markup: cancelKeyboard() });
        return;
      case 'title':
        await ctx.reply('🔎 Qaysi lavozim/kasb bo`yicha ish izlayapsiz?', {
          reply_markup: cancelKeyboard(),
        });
        return;
      case 'experience':
        await ctx.reply('🛠 Necha yil tajribangiz bor? (raqam, yo`q bo`lsa 0):', {
          reply_markup: cancelKeyboard(),
        });
        return;
      case 'skills':
        await ctx.reply("⚡ Ko'nikmalaringiz (vergul bilan, bo'lmasa «-»):", {
          reply_markup: skipKeyboard(),
        });
        return;
      case 'education':
        await ctx.reply("🎓 Ma'lumotingiz (bo'lmasa «-»):", { reply_markup: skipKeyboard() });
        return;
      case 'about':
        await ctx.reply("📝 O'zingiz haqida batafsil yozing (kamida 20 belgi):", {
          reply_markup: cancelKeyboard(),
        });
        return;
      case 'phone':
        await ctx.reply('📞 Telefon raqamingiz (+998...):', { reply_markup: cancelKeyboard() });
        return;
      case 'confirm':
        await this.showPreview(ctx, state);
        return;
    }
  }

  private async showPreview(ctx: Context, state: IntakeState): Promise<void> {
    const d = state.draft;
    const regionName = d.regionCode
      ? ((await this.prisma.region.findUnique({ where: { code: d.regionCode } }))?.nameUz ?? '')
      : '';

    const html =
      state.flow === 'vacancy'
        ? vacancyHtml({
            id: 'preview',
            title: d.title ?? '',
            description: d.description ?? '',
            company: d.company,
            regionName,
            salaryMin: d.salaryMin,
            salaryMax: d.salaryMax,
            currency: (d.currency ?? 'UZS') as Currency,
            employmentType: (d.employmentType ?? 'FULL_TIME') as EmploymentType,
            phones: d.phones ?? [],
            sourceChannels: [],
          })
        : resumeHtml({
            id: 'preview',
            fullName: d.fullName ?? '',
            age: d.age,
            title: d.title ?? '',
            about: d.about ?? '',
            regionName,
            experienceYears: d.experienceYears,
            education: d.education,
            skills: d.skills ?? [],
            salaryExpectation: d.salaryExpectation,
            currency: (d.currency ?? 'UZS') as Currency,
            phones: d.phones ?? [],
          });

    await ctx.reply(`👀 <b>Ko'rinishi:</b>\n\n${html}`, {
      parse_mode: 'HTML',
      reply_markup: confirmKeyboard(),
    });
  }

  // ===================== save =====================

  private async save(ctx: Context, state: IntakeState): Promise<void> {
    if (!ctx.from) return;
    const d = state.draft;

    const user = await this.prisma.appUser.upsert({
      where: { tgUserId: BigInt(ctx.from.id) },
      update: { username: ctx.from.username, firstName: ctx.from.first_name },
      create: {
        tgUserId: BigInt(ctx.from.id),
        username: ctx.from.username,
        firstName: ctx.from.first_name,
      },
    });

    const region = await this.prisma.region.findUnique({
      where: { code: d.regionCode ?? 'other' },
    });
    const category = await this.prisma.category.findUnique({
      where: { code: d.categoryCode ?? 'boshqa' },
    });
    if (!region || !category) {
      this.logger.error(`Intake save: region/category topilmadi (${d.regionCode}/${d.categoryCode})`);
      await ctx.reply('Xatolik yuz berdi, qaytadan urinib ko`ring. /start');
      return;
    }

    try {
      if (state.flow === 'vacancy') {
        const vacancy = await this.prisma.vacancy.create({
          data: {
            title: d.title ?? '',
            description: d.description ?? '',
            company: d.company,
            regionId: region.id,
            categoryId: category.id,
            salaryMin: d.salaryMin,
            salaryMax: d.salaryMax,
            currency: (d.currency ?? 'UZS') as Currency,
            employmentType: (d.employmentType ?? 'FULL_TIME') as EmploymentType,
            phones: d.phones ?? [],
            tgContact: ctx.from.username ? `@${ctx.from.username}` : undefined,
            origin: Origin.BOT,
            submittedById: user.id,
            firstSeenAt: new Date(),
          },
          select: { id: true },
        });
        await this.publishQueue.add('publish', { vacancyId: vacancy.id, action: 'create' });
      } else {
        const resume = await this.prisma.resume.create({
          data: {
            fullName: d.fullName ?? '',
            age: d.age,
            title: d.title ?? '',
            about: d.about ?? '',
            regionId: region.id,
            categoryId: category.id,
            experienceYears: d.experienceYears,
            skills: d.skills ?? [],
            education: d.education,
            salaryExpectation: d.salaryExpectation,
            currency: (d.currency ?? 'UZS') as Currency,
            phones: d.phones ?? [],
            tgContact: ctx.from.username ? `@${ctx.from.username}` : undefined,
            origin: Origin.BOT,
            submittedById: user.id,
            firstSeenAt: new Date(),
          },
          select: { id: true },
        });
        await this.publishQueue.add('publish', { resumeId: resume.id, action: 'create' });
      }

      await this.state.clear(ctx.from.id);
      await ctx.reply(
        "✅ Qabul qilindi! E'loningiz tez orada guruhdagi tegishli mavzuga joylanadi.",
        { reply_markup: mainMenu() },
      );
    } catch (error) {
      this.logger.error(`Intake save failed: ${(error as Error).message}`);
      await ctx.reply('Saqlashda xatolik. Birozdan keyin qayta urinib ko`ring.');
    }
  }
}
