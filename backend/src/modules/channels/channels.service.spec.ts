import { Test } from '@nestjs/testing';
import { ChannelStatus, ChannelType } from '@prisma/client';
import { ChannelsService } from './channels.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ChannelsManager } from '../collector/channels.manager';
import { CollectorService } from '../collector/collector.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';

describe('ChannelsService', () => {
  let service: ChannelsService;

  const prisma = {
    channel: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
  };
  const manager = {
    isReady: true,
    join: jest.fn(),
    leave: jest.fn(),
  };
  const collector = { refreshActiveChannels: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ChannelsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ChannelsManager, useValue: manager },
        { provide: CollectorService, useValue: collector },
      ],
    }).compile();
    service = moduleRef.get(ChannelsService);
  });

  const dbChannel = {
    id: 'uuid-1',
    tgId: 123n,
    username: 'ishbor_uz',
    title: 'Ish bor',
    type: ChannelType.CHANNEL,
    status: ChannelStatus.ACTIVE,
    postsCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  describe('create', () => {
    it('kanal allaqachon kuzatilsa E4002 tashlaydi', async () => {
      prisma.channel.findFirst.mockResolvedValue(dbChannel);

      await expect(service.create('@ishbor_uz')).rejects.toMatchObject({
        code: ErrorCode.CHANNEL_ALREADY_MONITORED,
      });
      expect(manager.join).not.toHaveBeenCalled();
    });

    it('yangi kanalga join qilib saqlaydi va collectorni yangilaydi', async () => {
      prisma.channel.findFirst.mockResolvedValue(null);
      manager.join.mockResolvedValue({
        tgId: 123n,
        title: 'Ish bor',
        username: 'ishbor_uz',
        isGroup: false,
      });
      prisma.channel.upsert.mockResolvedValue(dbChannel);

      const result = await service.create('ishbor_uz');

      expect(manager.join).toHaveBeenCalledWith('ishbor_uz');
      expect(prisma.channel.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tgId: 123n } }),
      );
      expect(collector.refreshActiveChannels).toHaveBeenCalled();
      expect(result.tgId).toBe('123'); // BigInt -> string serializatsiya
    });

    it('join FloodWait xatosini (E4003) yuqoriga uzatadi', async () => {
      prisma.channel.findFirst.mockResolvedValue(null);
      manager.join.mockRejectedValue(
        new AppException(ErrorCode.CHANNEL_JOIN_FAILED, 'FloodWait', 429),
      );

      await expect(service.create('flooded')).rejects.toMatchObject({
        code: ErrorCode.CHANNEL_JOIN_FAILED,
      });
    });

    it('session yo`q bo`lsa demo rejimda join qilmasdan saqlaydi', async () => {
      (manager as { isReady: boolean }).isReady = false;
      prisma.channel.findFirst.mockResolvedValue(null);
      prisma.channel.upsert.mockResolvedValue(dbChannel);

      await service.create('demo_channel');

      expect(manager.join).not.toHaveBeenCalled();
      expect(prisma.channel.upsert).toHaveBeenCalled();
      (manager as { isReady: boolean }).isReady = true;
    });
  });

  describe('list', () => {
    it('cursor pagination: limit+1 olib nextCursor hisoblaydi', async () => {
      const rows = Array.from({ length: 3 }, (_, i) => ({ ...dbChannel, id: `id-${i}` }));
      prisma.channel.findMany.mockResolvedValue(rows);

      const page = await service.list(undefined, 2);

      expect(prisma.channel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 3 }),
      );
      expect(page.data).toHaveLength(2);
      expect(page.meta.nextCursor).toBe('id-1');
    });

    it('cursor berilsa skip 1 bilan davom etadi', async () => {
      prisma.channel.findMany.mockResolvedValue([]);
      await service.list('cursor-id', 20);
      expect(prisma.channel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: { id: 'cursor-id' }, skip: 1 }),
      );
    });
  });

  describe('remove', () => {
    it('soft delete + leave + refresh', async () => {
      prisma.channel.findFirst.mockResolvedValue(dbChannel);
      prisma.channel.update.mockResolvedValue(dbChannel);

      await service.remove('uuid-1');

      expect(prisma.channel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      );
      expect(manager.leave).toHaveBeenCalledWith(123n);
      expect(collector.refreshActiveChannels).toHaveBeenCalled();
    });

    it('topilmasa E1003', async () => {
      prisma.channel.findFirst.mockResolvedValue(null);
      await expect(service.remove('yo-q')).rejects.toMatchObject({
        code: ErrorCode.NOT_FOUND,
      });
    });
  });
});
