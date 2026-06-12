import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { PaymentProvider, PaymentPurpose, PaymentStatus } from '@prisma/client';
import { BillingService, FEATURED_PRICE_UZS } from './billing.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../redis/cache.service';
import { PUBLISH_QUEUE } from '../../queues/queue.types';
import { ErrorCode } from '../../common/errors/error-codes';

describe('BillingService', () => {
  let service: BillingService;

  const prisma = {
    plan: { findUnique: jest.fn(), findMany: jest.fn() },
    payment: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), aggregate: jest.fn(), count: jest.fn(), groupBy: jest.fn() },
    subscription: { updateMany: jest.fn(), create: jest.fn(), findFirst: jest.fn() },
    vacancy: { findFirst: jest.fn(), update: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn() },
    $queryRaw: jest.fn(),
  };
  const cache = { del: jest.fn(), delPattern: jest.fn() };
  const config = { get: jest.fn(() => undefined) };
  const publishQueue = { add: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cache },
        { provide: ConfigService, useValue: config },
        { provide: getQueueToken(PUBLISH_QUEUE), useValue: publishQueue },
      ],
    }).compile();
    service = moduleRef.get(BillingService);
  });

  describe('subscribeCheckout', () => {
    it('bepul reja -> darhol obuna, to`lovsiz', async () => {
      prisma.plan.findUnique.mockResolvedValue({ id: 'p-free', code: 'FREE', priceUzs: 0, durationDays: 3650 });
      prisma.subscription.updateMany.mockResolvedValue({});
      prisma.subscription.create.mockResolvedValue({});

      const res = await service.subscribeCheckout('u1', 'FREE', PaymentProvider.MANUAL);

      expect(res.paymentId).toBe('free');
      expect(prisma.subscription.create).toHaveBeenCalled();
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });

    it('pulli reja -> PENDING payment + MANUAL instruktsiya', async () => {
      prisma.plan.findUnique.mockResolvedValue({ id: 'p-pro', code: 'EMPLOYER_PRO', priceUzs: 299000, durationDays: 30 });
      prisma.payment.create.mockResolvedValue({ id: 'pay-1', amountUzs: 299000 });

      const res = await service.subscribeCheckout('u1', 'EMPLOYER_PRO', PaymentProvider.MANUAL);

      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ purpose: PaymentPurpose.SUBSCRIPTION, amountUzs: 299000 }),
        }),
      );
      expect(res.instructions).toContain('299');
    });

    it('topilmagan reja -> E1003', async () => {
      prisma.plan.findUnique.mockResolvedValue(null);
      await expect(service.subscribeCheckout('u1', 'YOQ', PaymentProvider.MANUAL)).rejects.toMatchObject({
        code: ErrorCode.NOT_FOUND,
      });
    });
  });

  describe('featureVacancyCheckout', () => {
    it('featured narxi bilan payment yaratadi', async () => {
      prisma.vacancy.findFirst.mockResolvedValue({ id: 'v1' });
      prisma.payment.create.mockResolvedValue({ id: 'pay-2', amountUzs: FEATURED_PRICE_UZS });

      await service.featureVacancyCheckout('u1', 'v1', PaymentProvider.MANUAL);

      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            purpose: PaymentPurpose.FEATURED_VACANCY,
            amountUzs: FEATURED_PRICE_UZS,
            referenceId: 'v1',
          }),
        }),
      );
    });
  });

  describe('confirmPayment', () => {
    it('FEATURED to`lov -> vakansiya featured=true + publish edit', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        id: 'pay-2',
        status: PaymentStatus.PENDING,
        purpose: PaymentPurpose.FEATURED_VACANCY,
        referenceId: 'v1',
      });
      prisma.payment.update.mockResolvedValue({
        id: 'pay-2',
        status: PaymentStatus.PAID,
        purpose: PaymentPurpose.FEATURED_VACANCY,
        referenceId: 'v1',
      });
      prisma.vacancy.update.mockResolvedValue({});
      prisma.vacancy.findUnique.mockResolvedValue({ regionId: 'r1' });

      await service.confirmPayment('pay-2');

      expect(prisma.vacancy.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'v1' },
          data: expect.objectContaining({ featured: true }),
        }),
      );
      expect(publishQueue.add).toHaveBeenCalledWith('publish', { vacancyId: 'v1', action: 'edit' });
    });

    it('SUBSCRIPTION to`lov -> obuna faollashadi', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        id: 'pay-1',
        status: PaymentStatus.PENDING,
        purpose: PaymentPurpose.SUBSCRIPTION,
        userId: 'u1',
        referenceId: 'p-pro',
      });
      prisma.payment.update.mockResolvedValue({
        id: 'pay-1',
        status: PaymentStatus.PAID,
        purpose: PaymentPurpose.SUBSCRIPTION,
        userId: 'u1',
        referenceId: 'p-pro',
      });
      prisma.plan.findUnique.mockResolvedValue({ id: 'p-pro', durationDays: 30 });
      prisma.subscription.updateMany.mockResolvedValue({});
      prisma.subscription.create.mockResolvedValue({});

      await service.confirmPayment('pay-1');

      expect(prisma.subscription.create).toHaveBeenCalled();
    });

    it('allaqachon PAID -> qayta qo`llamaydi', async () => {
      prisma.payment.findUnique.mockResolvedValue({ id: 'p', status: PaymentStatus.PAID });
      await service.confirmPayment('p');
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });
  });

  describe('expirePromotions', () => {
    it('muddati o`tgan featured va obunalarni o`chiradi', async () => {
      prisma.vacancy.updateMany.mockResolvedValue({ count: 3 });
      prisma.subscription.updateMany.mockResolvedValue({ count: 2 });

      const res = await service.expirePromotions();

      expect(res).toEqual({ vacancies: 3, subs: 2 });
    });
  });
});

describe('DiscoveryService extract', () => {
  // discovery alohida fayl, lekin extract'ni shu yerda tekshiramiz
  const { DiscoveryService } = require('../analyzer/discovery.service');
  const svc = new DiscoveryService({} as never);

  it('@mention va t.me havolalarni ajratadi', () => {
    const text = 'Batafsil @ish_kanal va https://t.me/vakansiya_uz | @hr_bot reklama';
    const found = svc.extract(text);
    expect(found).toContain('ish_kanal');
    expect(found).toContain('vakansiya_uz');
  });

  it('bot handle va shovqinni chiqaradi', () => {
    const found = svc.extract('@some_bot @telegram @real_channel');
    expect(found).not.toContain('some_bot');
    expect(found).not.toContain('telegram');
    expect(found).toContain('real_channel');
  });
});
