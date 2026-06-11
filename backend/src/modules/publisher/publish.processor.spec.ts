import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Currency, EmploymentType, VacancyStatus } from '@prisma/client';
import { PublishProcessor } from './publish.processor';
import { BotService } from './bot.service';
import { TopicsService } from './topics.service';
import { SmsService } from '../sms/sms.service';
import { PrismaService } from '../../prisma/prisma.service';
import { DEAD_LETTER_QUEUE, PublishJobData } from '../../queues/queue.types';
import { vacancyHtml, formatSalary } from './templates';

describe('PublishProcessor', () => {
  let processor: PublishProcessor;

  const botApi = {
    sendMessage: jest.fn(),
    editMessageText: jest.fn(),
    deleteMessage: jest.fn(),
  };
  const botService = {
    instance: { api: botApi },
    publishGroupId: -100123,
    username: 'vakansiya_demo_bot',
  };
  const topics = { ensureTopic: jest.fn(), resetTopic: jest.fn() };
  const prisma = {
    publishedPost: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    publishedResume: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn() },
    vacancy: { findUnique: jest.fn() },
    resume: { findUnique: jest.fn() },
    region: { findUnique: jest.fn() },
  };
  const dlq = { add: jest.fn() };

  const vacancy = {
    id: 'vac-1',
    title: 'Oshpaz kerak',
    description: 'Tajribali oshpaz kerak restoranga',
    company: null,
    regionId: 'reg-sam',
    district: null,
    salaryMin: 5_000_000,
    salaryMax: null,
    currency: Currency.UZS,
    employmentType: EmploymentType.FULL_TIME,
    phones: ['998901234567'],
    tgContact: '@ish_kanal',
    status: VacancyStatus.ACTIVE,
    deletedAt: null,
    region: { nameUz: 'Samarqand' },
    sources: [{ rawPost: { channel: { title: 'Ish Bor Kanal' } } }],
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        PublishProcessor,
        { provide: BotService, useValue: botService },
        { provide: TopicsService, useValue: topics },
        { provide: PrismaService, useValue: prisma },
        { provide: SmsService, useValue: { getSettings: jest.fn().mockResolvedValue({ enabled: false }), send: jest.fn() } },
        { provide: getQueueToken(DEAD_LETTER_QUEUE), useValue: dlq },
      ],
    }).compile();
    processor = moduleRef.get(PublishProcessor);
  });

  const makeJob = (data: PublishJobData) => ({ data }) as Job<PublishJobData>;

  it('vakansiyani to`g`ri topic (thread_id) ga yuboradi', async () => {
    prisma.publishedPost.findUnique.mockResolvedValue(null);
    prisma.vacancy.findUnique.mockResolvedValue(vacancy);
    topics.ensureTopic.mockResolvedValue(42);
    botApi.sendMessage.mockResolvedValue({ message_id: 555 });

    await processor.process(makeJob({ vacancyId: 'vac-1', action: 'create' }));

    expect(botApi.sendMessage).toHaveBeenCalledWith(
      -100123,
      expect.stringContaining('Oshpaz kerak'),
      expect.objectContaining({ message_thread_id: 42, parse_mode: 'HTML' }),
    );
    expect(prisma.publishedPost.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ vacancyId: 'vac-1', tgMessageId: 555, tgTopicId: 42 }),
    });
  });

  it('allaqachon joylangan bo`lsa QAYTA YUBORMAYDI (double-publish himoya)', async () => {
    prisma.publishedPost.findUnique.mockResolvedValue({ id: 'pub-1' });

    await processor.process(makeJob({ vacancyId: 'vac-1', action: 'create' }));

    expect(botApi.sendMessage).not.toHaveBeenCalled();
  });

  it('TOPIC_DELETED -> topic reset qilib qayta yaratadi va yuboradi', async () => {
    prisma.publishedPost.findUnique.mockResolvedValue(null);
    prisma.vacancy.findUnique.mockResolvedValue(vacancy);
    topics.ensureTopic.mockResolvedValueOnce(42).mockResolvedValueOnce(77);
    botApi.sendMessage
      .mockRejectedValueOnce({ description: 'Bad Request: message thread not found' })
      .mockResolvedValueOnce({ message_id: 600 });

    await processor.process(makeJob({ vacancyId: 'vac-1', action: 'create' }));

    expect(topics.resetTopic).toHaveBeenCalledWith('reg-sam');
    expect(botApi.sendMessage).toHaveBeenLastCalledWith(
      -100123,
      expect.any(String),
      expect.objectContaining({ message_thread_id: 77 }),
    );
    expect(prisma.publishedPost.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tgTopicId: 77 }),
    });
  });

  it('HIDDEN/EXPIRED vakansiya uchun deleteMessage', async () => {
    prisma.publishedPost.findUnique.mockResolvedValue({
      vacancyId: 'vac-1',
      tgChatId: -100123n,
      tgMessageId: 555,
    });

    await processor.process(makeJob({ vacancyId: 'vac-1', action: 'delete' }));

    expect(botApi.deleteMessage).toHaveBeenCalledWith(-100123, 555);
    expect(prisma.publishedPost.delete).toHaveBeenCalledWith({ where: { vacancyId: 'vac-1' } });
  });

  it('edit -> editMessageText chaqiriladi', async () => {
    prisma.publishedPost.findUnique.mockResolvedValue({
      vacancyId: 'vac-1',
      tgChatId: -100123n,
      tgMessageId: 555,
      vacancy,
    });

    await processor.process(makeJob({ vacancyId: 'vac-1', action: 'edit' }));

    expect(botApi.editMessageText).toHaveBeenCalledWith(
      -100123,
      555,
      expect.stringContaining('Oshpaz'),
      expect.objectContaining({ parse_mode: 'HTML' }),
    );
  });

  it('rezyume "resumes" topic ga joylanadi', async () => {
    prisma.publishedResume.findUnique.mockResolvedValue(null);
    prisma.resume.findUnique.mockResolvedValue({
      id: 'res-1',
      fullName: 'Jasur Karimov',
      age: 25,
      title: 'Haydovchi',
      about: 'Tajribali haydovchiman',
      regionId: 'reg-tosh',
      experienceYears: 3,
      education: null,
      skills: ['B toifa'],
      salaryExpectation: null,
      currency: Currency.UZS,
      phones: ['998901112233'],
      tgContact: null,
      status: VacancyStatus.ACTIVE,
      deletedAt: null,
      region: { nameUz: 'Toshkent shahri' },
    });
    prisma.region.findUnique.mockResolvedValue({ id: 'reg-resumes', code: 'resumes' });
    topics.ensureTopic.mockResolvedValue(91);
    botApi.sendMessage.mockResolvedValue({ message_id: 700 });

    await processor.process(makeJob({ resumeId: 'res-1', action: 'create' }));

    expect(topics.ensureTopic).toHaveBeenCalledWith('reg-resumes');
    expect(botApi.sendMessage).toHaveBeenCalledWith(
      -100123,
      expect.stringContaining('Jasur Karimov'),
      expect.objectContaining({ message_thread_id: 91 }),
    );
    expect(prisma.publishedResume.create).toHaveBeenCalled();
  });

  it('bot sozlanmagan bo`lsa jim skip qiladi', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PublishProcessor,
        { provide: BotService, useValue: { instance: null, publishGroupId: null, username: '' } },
        { provide: TopicsService, useValue: topics },
        { provide: PrismaService, useValue: prisma },
        { provide: SmsService, useValue: { getSettings: jest.fn().mockResolvedValue({ enabled: false }), send: jest.fn() } },
        { provide: getQueueToken(DEAD_LETTER_QUEUE), useValue: dlq },
      ],
    }).compile();
    const offlineProcessor = moduleRef.get(PublishProcessor);

    await expect(
      offlineProcessor.process(makeJob({ vacancyId: 'vac-1', action: 'create' })),
    ).resolves.toBeUndefined();
    expect(botApi.sendMessage).not.toHaveBeenCalled();
  });
});

describe('templates', () => {
  it('vacancyHtml HTML-escape qiladi va kerakli bo`limlarni o`z ichiga oladi', () => {
    const html = vacancyHtml({
      id: 'v1',
      title: 'Oshpaz <script>',
      description: 'Tavsif & batafsil',
      company: 'Plov & Co',
      regionName: 'Samarqand',
      district: 'Urgut',
      salaryMin: 5_000_000,
      salaryMax: 7_000_000,
      currency: Currency.UZS,
      employmentType: EmploymentType.FULL_TIME,
      phones: ['998901234567'],
      tgContact: '@kanal',
      sourceChannels: ['Ish Bor'],
    });

    expect(html).toContain('Oshpaz &lt;script&gt;');
    expect(html).toContain('Plov &amp; Co');
    expect(html).toContain('5 000 000–7 000 000');
    expect(html).toContain('Samarqand, Urgut');
    expect(html).toContain('+998901234567');
    expect(html).toContain('📡 Manba: Ish Bor');
  });

  it('uzun tavsif 400 belgiga qisqartiriladi', () => {
    const html = vacancyHtml({
      id: 'v2',
      title: 'Test',
      description: 'a'.repeat(1000),
      regionName: 'Toshkent shahri',
      currency: Currency.UZS,
      employmentType: EmploymentType.FULL_TIME,
      phones: [],
      sourceChannels: [],
    });
    expect(html).toContain('…');
    expect(html.length).toBeLessThan(700);
  });

  it('formatSalary: kelishilgan', () => {
    expect(formatSalary(null, null)).toBe('Kelishilgan');
    expect(formatSalary(500, null, Currency.USD)).toBe('500 $');
  });
});
