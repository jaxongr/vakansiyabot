import { Test } from '@nestjs/testing';
import { Context } from 'grammy';
import { getQueueToken } from '@nestjs/bullmq';
import { IntakeService } from './intake.service';
import { IntakeState, IntakeStateService } from './intake-state.service';
import { RulesService } from '../analyzer/rules.service';
import { NormalizeService } from '../dedup/normalize.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MENU_VACANCY } from './intake.keyboards';
import { PUBLISH_QUEUE } from '../../queues/queue.types';

describe('IntakeService', () => {
  let service: IntakeService;

  const states = new Map<number, IntakeState>();
  const stateService = {
    get: jest.fn(async (id: number) => states.get(id) ?? null),
    set: jest.fn(async (id: number, s: IntakeState) => void states.set(id, s)),
    clear: jest.fn(async (id: number) => void states.delete(id)),
  };
  const prisma = {
    region: { findMany: jest.fn(), findUnique: jest.fn() },
    category: { findMany: jest.fn(), findUnique: jest.fn() },
    appUser: { upsert: jest.fn() },
    vacancy: { create: jest.fn() },
    resume: { create: jest.fn() },
  };
  const publishQueue = { add: jest.fn() };

  const makeCtx = (overrides: Record<string, unknown> = {}): Context => {
    return {
      chat: { type: 'private' },
      from: { id: 777, username: 'tester', first_name: 'Test' },
      reply: jest.fn().mockResolvedValue(undefined),
      answerCallbackQuery: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    } as unknown as Context;
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    states.clear();
    const moduleRef = await Test.createTestingModule({
      providers: [
        IntakeService,
        RulesService,
        NormalizeService,
        { provide: IntakeStateService, useValue: stateService },
        { provide: PrismaService, useValue: prisma },
        { provide: getQueueToken(PUBLISH_QUEUE), useValue: publishQueue },
      ],
    }).compile();
    service = moduleRef.get(IntakeService);
  });

  // private metodlarga test uchun kirish
  const onText = (ctx: Context) =>
    (service as unknown as { onText: (c: Context) => Promise<void> }).onText(ctx);
  const onCallback = (ctx: Context) =>
    (service as unknown as { onCallback: (c: Context) => Promise<void> }).onCallback(ctx);

  it('menyu tugmasi vacancy flow ni boshlaydi (step=title)', async () => {
    const ctx = makeCtx({ message: { text: MENU_VACANCY } });

    await onText(ctx);

    expect(states.get(777)).toMatchObject({ flow: 'vacancy', step: 'title' });
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Lavozim'),
      expect.any(Object),
    );
  });

  it('title kiritilgach companyga o`tadi', async () => {
    states.set(777, { flow: 'vacancy', step: 'title', draft: {} });
    const ctx = makeCtx({ message: { text: 'Oshpaz kerak' } });

    await onText(ctx);

    expect(states.get(777)).toMatchObject({ step: 'company', draft: { title: 'Oshpaz kerak' } });
  });

  it('juda qisqa title qabul qilinmaydi, qadm o`zgarmaydi', async () => {
    states.set(777, { flow: 'vacancy', step: 'title', draft: {} });
    const ctx = makeCtx({ message: { text: 'ab' } });

    await onText(ctx);

    expect(states.get(777)?.step).toBe('title');
  });

  it('region callback draft ga yoziladi', async () => {
    states.set(777, { flow: 'vacancy', step: 'region', draft: { title: 'X' } });
    prisma.category.findMany.mockResolvedValue([]);
    const ctx = makeCtx({ callbackQuery: { data: 'int:reg:samarqand' } });

    await onCallback(ctx);

    expect(states.get(777)).toMatchObject({
      step: 'category',
      draft: { regionCode: 'samarqand' },
    });
  });

  it('noto`g`ri telefon qabul qilinmaydi', async () => {
    states.set(777, { flow: 'vacancy', step: 'phone', draft: {} });
    const ctx = makeCtx({ message: { text: 'raqamim yo`q' } });

    await onText(ctx);

    expect(states.get(777)?.step).toBe('phone');
  });

  it('int:cancel holatni tozalaydi', async () => {
    states.set(777, { flow: 'resume', step: 'age', draft: { fullName: 'A B' } });
    const ctx = makeCtx({ callbackQuery: { data: 'int:cancel' } });

    await onCallback(ctx);

    expect(states.has(777)).toBe(false);
  });

  it('confirm -> vacancy saqlanadi va publish queue ga boradi', async () => {
    states.set(777, {
      flow: 'vacancy',
      step: 'confirm',
      draft: {
        title: 'Oshpaz kerak',
        description: 'Tajribali oshpaz kerak, sharoit yaxshi',
        regionCode: 'samarqand',
        categoryCode: 'xizmat',
        salaryMin: 5_000_000,
        currency: 'UZS',
        employmentType: 'FULL_TIME',
        phones: ['998901234567'],
      },
    });
    prisma.appUser.upsert.mockResolvedValue({ id: 'user-1' });
    prisma.region.findUnique.mockResolvedValue({ id: 'reg-1', code: 'samarqand' });
    prisma.category.findUnique.mockResolvedValue({ id: 'cat-1', code: 'xizmat' });
    prisma.vacancy.create.mockResolvedValue({ id: 'vac-bot-1' });

    const ctx = makeCtx({ callbackQuery: { data: 'int:ok' } });
    await onCallback(ctx);

    expect(prisma.vacancy.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ origin: 'BOT', submittedById: 'user-1' }),
      }),
    );
    expect(publishQueue.add).toHaveBeenCalledWith('publish', {
      vacancyId: 'vac-bot-1',
      action: 'create',
    });
    expect(states.has(777)).toBe(false);
  });

  it('confirm -> resume saqlanadi', async () => {
    states.set(777, {
      flow: 'resume',
      step: 'confirm',
      draft: {
        fullName: 'Jasur Karimov',
        age: 25,
        title: 'Haydovchi',
        about: 'Tajribali haydovchiman, B toifa guvohnoma bor',
        regionCode: 'toshkent-shahri',
        categoryCode: 'haydovchi',
        phones: ['998901112233'],
        skills: ['B toifa'],
      },
    });
    prisma.appUser.upsert.mockResolvedValue({ id: 'user-1' });
    prisma.region.findUnique.mockResolvedValue({ id: 'reg-1', code: 'toshkent-shahri' });
    prisma.category.findUnique.mockResolvedValue({ id: 'cat-1', code: 'haydovchi' });
    prisma.resume.create.mockResolvedValue({ id: 'res-bot-1' });

    const ctx = makeCtx({ callbackQuery: { data: 'int:ok' } });
    await onCallback(ctx);

    expect(prisma.resume.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ fullName: 'Jasur Karimov', origin: 'BOT' }),
      }),
    );
    expect(publishQueue.add).toHaveBeenCalledWith('publish', {
      resumeId: 'res-bot-1',
      action: 'create',
    });
  });

  it('guruh chatidagi matnga javob bermaydi', async () => {
    const ctx = makeCtx({ chat: { type: 'supergroup' }, message: { text: MENU_VACANCY } });
    await onText(ctx);
    expect(states.has(777)).toBe(false);
    expect(ctx.reply).not.toHaveBeenCalled();
  });
});
