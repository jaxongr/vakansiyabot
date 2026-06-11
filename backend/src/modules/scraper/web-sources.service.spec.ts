import { WebSourceStatus, WebSourceType } from '@prisma/client';
import { WebSourcesService } from './web-sources.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ScraperService } from './scraper.service';
import { ErrorCode } from '../../common/errors/error-codes';

describe('WebSourcesService', () => {
  let service: WebSourcesService;
  const prisma = {
    webSource: { findFirst: jest.fn(), create: jest.fn(), findMany: jest.fn(), update: jest.fn() },
  };
  const scraper = { scrapeOne: jest.fn().mockResolvedValue(3) };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WebSourcesService(
      prisma as unknown as PrismaService,
      scraper as unknown as ScraperService,
    );
  });

  const dto = {
    type: WebSourceType.GENERIC_RSS,
    name: 'Test',
    url: 'https://example.com/rss',
    intervalMin: 30,
  };

  it('create -> saqlaydi va darhol skanerlaydi', async () => {
    prisma.webSource.findFirst.mockResolvedValue(null);
    prisma.webSource.create.mockResolvedValue({ id: 'ws1', ...dto });
    const res = await service.create(dto);
    expect(res).toMatchObject({ id: 'ws1' });
    expect(scraper.scrapeOne).toHaveBeenCalled();
  });

  it('takror URL -> conflict', async () => {
    prisma.webSource.findFirst.mockResolvedValue({ id: 'exists' });
    await expect(service.create(dto)).rejects.toBeDefined();
    expect(prisma.webSource.create).not.toHaveBeenCalled();
  });

  it('triggerNow -> created soni qaytaradi', async () => {
    prisma.webSource.findFirst.mockResolvedValue({ id: 'ws1', ...dto });
    const res = await service.triggerNow('ws1');
    expect(res).toEqual({ created: 3 });
  });

  it('setStatus topilmasa E1003', async () => {
    prisma.webSource.findFirst.mockResolvedValue(null);
    await expect(service.setStatus('yoq', WebSourceStatus.PAUSED)).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND,
    });
  });

  it('remove -> soft delete', async () => {
    prisma.webSource.findFirst.mockResolvedValue({ id: 'ws1' });
    prisma.webSource.update.mockResolvedValue({});
    await service.remove('ws1');
    expect(prisma.webSource.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
    );
  });
});
