import { TopicsService } from './topics.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Bot } from 'grammy';

describe('TopicsService', () => {
  let service: TopicsService;

  const prisma = {
    region: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  };
  const botApi = { createForumTopic: jest.fn() };
  const bot = { api: botApi } as unknown as Bot;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    service = new TopicsService(prisma as unknown as PrismaService);
    service.attach(bot, -100123);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const region = (id: string, tgTopicId: number | null) => ({
    id,
    code: `code-${id}`,
    nameUz: `Region ${id}`,
    nameCyr: '',
    tgTopicId,
    special: false,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  describe('setupTopics — idempotentlik', () => {
    it('tgTopicId bor regionlarni QAYTA YARATMAYDI', async () => {
      prisma.region.findMany.mockResolvedValue([region('a', 11), region('b', 22)]);

      const result = await service.setupTopics();

      expect(botApi.createForumTopic).not.toHaveBeenCalled();
      expect(result).toEqual({ created: 0, existing: 2, failed: 0 });
    });

    it('tgTopicId=null bo`lganlar uchun yaratib saqlaydi', async () => {
      prisma.region.findMany.mockResolvedValue([region('a', 11), region('b', null)]);
      botApi.createForumTopic.mockResolvedValue({ message_thread_id: 777 });
      prisma.region.update.mockResolvedValue(region('b', 777));

      const promise = service.setupTopics();
      await jest.runAllTimersAsync();
      const result = await promise;

      expect(botApi.createForumTopic).toHaveBeenCalledTimes(1);
      expect(botApi.createForumTopic).toHaveBeenCalledWith(-100123, 'Region b');
      expect(prisma.region.update).toHaveBeenCalledWith({
        where: { id: 'b' },
        data: { tgTopicId: 777 },
      });
      expect(result).toEqual({ created: 1, existing: 1, failed: 0 });
    });

    it('bitta xato boshqalarini to`xtatmaydi (E4006)', async () => {
      prisma.region.findMany.mockResolvedValue([region('a', null), region('b', null)]);
      botApi.createForumTopic
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce({ message_thread_id: 88 });
      prisma.region.update.mockResolvedValue(region('b', 88));

      const promise = service.setupTopics();
      await jest.runAllTimersAsync();
      const result = await promise;

      expect(result).toEqual({ created: 1, existing: 0, failed: 1 });
    });

    it('bot ulanmagan bo`lsa hech narsa qilmaydi', async () => {
      service.attach(null, null);
      const result = await service.setupTopics();
      expect(result).toEqual({ created: 0, existing: 0, failed: 0 });
      expect(prisma.region.findMany).not.toHaveBeenCalled();
    });
  });

  describe('ensureTopic', () => {
    it('mavjud topic id ni qaytaradi', async () => {
      prisma.region.findUnique.mockResolvedValue(region('a', 55));
      expect(await service.ensureTopic('a')).toBe(55);
      expect(botApi.createForumTopic).not.toHaveBeenCalled();
    });

    it('yo`q bo`lsa yaratadi', async () => {
      prisma.region.findUnique.mockResolvedValue(region('a', null));
      botApi.createForumTopic.mockResolvedValue({ message_thread_id: 99 });
      prisma.region.update.mockResolvedValue(region('a', 99));

      expect(await service.ensureTopic('a')).toBe(99);
    });
  });

  describe('resetTopic — TOPIC_DELETED recovery', () => {
    it('tgTopicId ni null qiladi', async () => {
      await service.resetTopic('a');
      expect(prisma.region.update).toHaveBeenCalledWith({
        where: { id: 'a' },
        data: { tgTopicId: null },
      });
    });
  });
});
