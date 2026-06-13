import { AlertsService } from './alerts.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BotService } from '../publisher/bot.service';

describe('AlertsService', () => {
  let service: AlertsService;
  const prisma = {
    savedSearch: { findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn(), deleteMany: jest.fn() },
    vacancy: { findUnique: jest.fn() },
  };
  const botApi = { sendMessage: jest.fn() };
  const bot = { instance: { api: botApi }, username: 'vakansiya_bot' };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AlertsService(prisma as unknown as PrismaService, bot as unknown as BotService);
  });

  describe('create', () => {
    it('saqlangan qidiruv yaratadi', async () => {
      prisma.savedSearch.count.mockResolvedValue(2);
      prisma.savedSearch.create.mockResolvedValue({ id: 's1' });
      const res = await service.create('u1', { regionId: 'r1', q: 'oshpaz' });
      expect(res).toEqual({ id: 's1' });
    });

    it('10 tadan ortiq -> xato', async () => {
      prisma.savedSearch.count.mockResolvedValue(10);
      await expect(service.create('u1', {})).rejects.toBeDefined();
    });
  });

  describe('notifyMatching', () => {
    const vacancy = {
      id: 'v1',
      title: 'Oshpaz kerak',
      description: 'tajribali oshpaz',
      regionId: 'r1',
      categoryId: 'c1',
      salaryMin: 5_000_000,
      salaryMax: null,
      currency: 'UZS',
      employmentType: 'FULL_TIME',
      region: { nameUz: 'Samarqand' },
      category: { nameUz: 'Xizmat' },
    };

    it('mos qidiruv egasiga xabar yuboradi', async () => {
      prisma.vacancy.findUnique.mockResolvedValue(vacancy);
      prisma.savedSearch.findMany.mockResolvedValue([
        { id: 's1', salaryMin: null, employmentType: null, q: null, user: { tgUserId: 777n } },
      ]);
      prisma.savedSearch.update.mockResolvedValue({});

      const sent = await service.notifyMatching('v1');

      expect(sent).toBe(1);
      expect(botApi.sendMessage).toHaveBeenCalledWith(
        777,
        expect.stringContaining('Yangi mos vakansiya'),
        expect.any(Object),
      );
    });

    it('maosh filtri mos kelmasa yubormaydi', async () => {
      prisma.vacancy.findUnique.mockResolvedValue(vacancy);
      prisma.savedSearch.findMany.mockResolvedValue([
        { id: 's1', salaryMin: 10_000_000, employmentType: null, q: null, user: { tgUserId: 777n } },
      ]);

      const sent = await service.notifyMatching('v1');

      expect(sent).toBe(0);
      expect(botApi.sendMessage).not.toHaveBeenCalled();
    });

    it('q (kalit so`z) mos kelmasa yubormaydi', async () => {
      prisma.vacancy.findUnique.mockResolvedValue(vacancy);
      prisma.savedSearch.findMany.mockResolvedValue([
        { id: 's1', salaryMin: null, employmentType: null, q: 'dasturchi', user: { tgUserId: 777n } },
      ]);

      const sent = await service.notifyMatching('v1');
      expect(sent).toBe(0);
    });
  });
});
