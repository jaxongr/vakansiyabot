import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { CollectorService } from './collector.service';
import { ChannelsManager } from './channels.manager';
import { PrismaService } from '../../prisma/prisma.service';
import { NormalizeService } from '../dedup/normalize.service';
import { SystemStatusService } from '../system/system-status.service';
import { ANALYZE_QUEUE } from '../../queues/queue.types';

describe('CollectorService', () => {
  let service: CollectorService;
  let status: SystemStatusService;

  const prisma = {
    channel: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
    rawPost: { create: jest.fn() },
    telegramSetting: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  const queue = { add: jest.fn() };
  const configValues: Record<string, unknown> = {};
  const config = {
    get: jest.fn((key: string) => configValues[key]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    Object.keys(configValues).forEach((k) => delete configValues[k]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        CollectorService,
        ChannelsManager,
        NormalizeService,
        SystemStatusService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
        { provide: getQueueToken(ANALYZE_QUEUE), useValue: queue },
      ],
    }).compile();

    service = moduleRef.get(CollectorService);
    status = moduleRef.get(SystemStatusService);
  });

  it('TG sozlamalari yo`q bo`lsa crash qilmasdan DISABLED holatga o`tadi', async () => {
    await service.onModuleInit();

    expect(status.get('collector')?.status).toBe('DISABLED');
  });

  describe('saveRawPost', () => {
    it('RawPost yozadi, postsCount oshiradi', async () => {
      prisma.rawPost.create.mockResolvedValue({ id: 'raw-1' });

      const result = await service.saveRawPost('ch-1', 100n, 'Ishchi kerak...', 1718000000);

      expect(result).toEqual({ id: 'raw-1' });
      expect(prisma.rawPost.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            channelId: 'ch-1',
            tgMessageId: 100n,
            textHash: expect.stringMatching(/^[a-f0-9]{64}$/),
          }),
        }),
      );
      expect(prisma.channel.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { postsCount: { increment: 1 } } }),
      );
    });

    it('dublikat xabarda (P2002) null qaytaradi, xato tashlamaydi', async () => {
      prisma.rawPost.create.mockRejectedValue({ code: 'P2002' });

      const result = await service.saveRawPost('ch-1', 100n, 'Takror post', 1718000000);

      expect(result).toBeNull();
      expect(prisma.channel.update).not.toHaveBeenCalled();
    });

    it('boshqa xatolarni yuqoriga uzatadi', async () => {
      prisma.rawPost.create.mockRejectedValue(new Error('db down'));

      await expect(service.saveRawPost('ch-1', 1n, 'text', 1718000000)).rejects.toThrow('db down');
    });
  });

  describe('refreshActiveChannels', () => {
    it('faqat ACTIVE va o`chirilmagan kanallarni oladi', async () => {
      prisma.channel.findMany.mockResolvedValue([{ id: 'ch-1', tgId: 555n }]);

      await service.refreshActiveChannels();

      expect(prisma.channel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'ACTIVE', deletedAt: null },
        }),
      );
    });
  });
});

describe('ChannelsManager (mock client)', () => {
  let manager: ChannelsManager;

  beforeEach(() => {
    manager = new ChannelsManager();
  });

  it('client yo`q bo`lsa join E4004 tashlaydi', async () => {
    await expect(manager.join('test')).rejects.toMatchObject({ code: 'E4004' });
  });

  it('client yo`q bo`lsa leave jim o`tadi', async () => {
    await expect(manager.leave(1n)).resolves.toBeUndefined();
  });

  it('isReady client holatini aks ettiradi', () => {
    expect(manager.isReady).toBe(false);
    manager.setClient({} as never);
    expect(manager.isReady).toBe(true);
  });
});
