import { ApplicationStatus, Role } from '@prisma/client';
import { ApplicationsService } from './applications.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';
import { BotService } from '../publisher/bot.service';
import { ErrorCode } from '../../common/errors/error-codes';

describe('ApplicationsService', () => {
  let service: ApplicationsService;
  const prisma = {
    vacancy: { findFirst: jest.fn() },
    resume: { findFirst: jest.fn() },
    application: { create: jest.fn(), count: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  };
  const sms = { send: jest.fn() };
  const botApi = { sendMessage: jest.fn() };
  const bot = { instance: { api: botApi } };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ApplicationsService(
      prisma as unknown as PrismaService,
      sms as unknown as SmsService,
      bot as unknown as BotService,
    );
  });

  describe('apply', () => {
    it('ariza yaratadi va ish beruvchiga xabar yuboradi', async () => {
      prisma.vacancy.findFirst.mockResolvedValue({
        id: 'v1',
        title: 'Oshpaz',
        submittedBy: { tgUserId: 777n },
      });
      prisma.application.create.mockResolvedValue({ id: 'a1' });
      prisma.application.count.mockResolvedValue(3);

      const res = await service.apply('u1', { vacancyId: 'v1' });

      expect(res).toEqual({ id: 'a1', applied: true });
      expect(botApi.sendMessage).toHaveBeenCalledWith(
        777,
        expect.stringContaining('yangi ariza'),
        expect.any(Object),
      );
    });

    it('takror ariza -> conflict', async () => {
      prisma.vacancy.findFirst.mockResolvedValue({ id: 'v1', title: 'X', submittedBy: null });
      prisma.application.create.mockRejectedValue({ code: 'P2002' });

      await expect(service.apply('u1', { vacancyId: 'v1' })).rejects.toMatchObject({
        code: ErrorCode.CONFLICT,
      });
    });

    it('vakansiya topilmasa -> E1003', async () => {
      prisma.vacancy.findFirst.mockResolvedValue(null);
      await expect(service.apply('u1', { vacancyId: 'yoq' })).rejects.toMatchObject({
        code: ErrorCode.NOT_FOUND,
      });
    });
  });

  describe('applicationsForVacancy', () => {
    it('egasi ko`radi', async () => {
      prisma.vacancy.findFirst.mockResolvedValue({ id: 'v1', submittedById: 'u1' });
      prisma.application.findMany.mockResolvedValue([{ id: 'a1' }]);
      const res = await service.applicationsForVacancy('v1', 'u1', Role.USER);
      expect(res).toHaveLength(1);
    });

    it('begona -> forbidden', async () => {
      prisma.vacancy.findFirst.mockResolvedValue({ id: 'v1', submittedById: 'owner' });
      await expect(service.applicationsForVacancy('v1', 'boshqa', Role.USER)).rejects.toMatchObject({
        code: ErrorCode.FORBIDDEN,
      });
    });

    it('admin har doim ko`radi', async () => {
      prisma.vacancy.findFirst.mockResolvedValue({ id: 'v1', submittedById: 'owner' });
      prisma.application.findMany.mockResolvedValue([]);
      await expect(service.applicationsForVacancy('v1', 'admin', Role.ADMIN)).resolves.toEqual([]);
    });
  });

  describe('setStatus', () => {
    it('egasi statusni o`zgartiradi', async () => {
      prisma.application.findUnique.mockResolvedValue({
        id: 'a1',
        vacancy: { submittedById: 'u1' },
      });
      prisma.application.update.mockResolvedValue({ id: 'a1', status: 'SHORTLISTED' });
      const res = await service.setStatus('a1', 'u1', Role.USER, ApplicationStatus.SHORTLISTED);
      expect(res.status).toBe('SHORTLISTED');
    });

    it('begona -> forbidden', async () => {
      prisma.application.findUnique.mockResolvedValue({
        id: 'a1',
        vacancy: { submittedById: 'owner' },
      });
      await expect(
        service.setStatus('a1', 'boshqa', Role.USER, ApplicationStatus.HIRED),
      ).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
    });
  });
});
