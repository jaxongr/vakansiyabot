import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  Payment,
  PaymentProvider,
  PaymentPurpose,
  PaymentStatus,
  Plan,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../redis/cache.service';
import { AppException } from '../../common/errors/app.exception';
import { PUBLISH_QUEUE, PublishJobData } from '../../queues/queue.types';
import { buildCheckout, CheckoutResult } from './payment-providers';

/** Featured e'lon narxi (UZS) va muddati (kun) */
export const FEATURED_PRICE_UZS = 30_000;
export const FEATURED_DAYS = 7;

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly config: ConfigService,
    @InjectQueue(PUBLISH_QUEUE) private readonly publishQueue: Queue<PublishJobData>,
  ) {}

  plans(): Promise<Plan[]> {
    return this.prisma.plan.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } });
  }

  // ===================== Checkout yaratish =====================

  async subscribeCheckout(
    userId: string,
    planCode: string,
    provider: PaymentProvider,
  ): Promise<CheckoutResult & { paymentId: string }> {
    const plan = await this.prisma.plan.findUnique({ where: { code: planCode as never } });
    if (!plan) throw AppException.notFound('Tarif topilmadi');
    if (plan.priceUzs === 0) {
      // bepul reja — darhol faollashtiramiz
      await this.activateSubscription(userId, plan);
      return { provider, paymentId: 'free', instructions: 'Bepul reja faollashtirildi' };
    }
    const payment = await this.createPayment(
      userId,
      plan.priceUzs,
      provider,
      PaymentPurpose.SUBSCRIPTION,
      plan.id,
    );
    return { ...this.checkout(provider, payment), paymentId: payment.id };
  }

  async featureVacancyCheckout(
    userId: string | null,
    vacancyId: string,
    provider: PaymentProvider,
  ): Promise<CheckoutResult & { paymentId: string }> {
    const vacancy = await this.prisma.vacancy.findFirst({
      where: { id: vacancyId, deletedAt: null },
    });
    if (!vacancy) throw AppException.notFound('Vakansiya topilmadi');
    const payment = await this.createPayment(
      userId,
      FEATURED_PRICE_UZS,
      provider,
      PaymentPurpose.FEATURED_VACANCY,
      vacancyId,
    );
    return { ...this.checkout(provider, payment), paymentId: payment.id };
  }

  private checkout(provider: PaymentProvider, payment: Payment): CheckoutResult {
    return buildCheckout(provider, payment.id, payment.amountUzs, {
      paymeMerchantId: this.config.get('PAYME_MERCHANT_ID'),
      clickMerchantId: this.config.get('CLICK_MERCHANT_ID'),
      clickServiceId: this.config.get('CLICK_SERVICE_ID'),
    });
  }

  private createPayment(
    userId: string | null,
    amountUzs: number,
    provider: PaymentProvider,
    purpose: PaymentPurpose,
    referenceId: string,
  ): Promise<Payment> {
    return this.prisma.payment.create({
      data: { userId, amountUzs, provider, purpose, referenceId },
    });
  }

  // ===================== To'lovni tasdiqlash (admin / webhook) =====================

  async confirmPayment(paymentId: string, providerTxnId?: string): Promise<Payment> {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw AppException.notFound('To`lov topilmadi');
    if (payment.status === PaymentStatus.PAID) return payment;

    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.PAID, paidAt: new Date(), providerTxnId },
    });

    await this.applyEffect(updated);
    await this.cache.del('stats:overview');
    this.logger.log(`Payment ${paymentId} tasdiqlandi: ${payment.purpose}`);
    return updated;
  }

  private async applyEffect(payment: Payment): Promise<void> {
    if (payment.purpose === PaymentPurpose.SUBSCRIPTION && payment.userId && payment.referenceId) {
      const plan = await this.prisma.plan.findUnique({ where: { id: payment.referenceId } });
      if (plan) await this.activateSubscription(payment.userId, plan);
    } else if (payment.purpose === PaymentPurpose.FEATURED_VACANCY && payment.referenceId) {
      await this.prisma.vacancy.update({
        where: { id: payment.referenceId },
        data: {
          featured: true,
          promotedUntil: new Date(Date.now() + FEATURED_DAYS * 24 * 3600_000),
        },
      });
      // guruh postini qayta joylash uchun edit (tepaga ko'tarish effekti)
      await this.publishQueue.add('publish', {
        vacancyId: payment.referenceId,
        action: 'edit',
      });
      await this.invalidateVacancyCache(payment.referenceId);
    }
  }

  private async activateSubscription(userId: string, plan: Plan): Promise<void> {
    await this.prisma.subscription.updateMany({
      where: { userId, active: true },
      data: { active: false },
    });
    await this.prisma.subscription.create({
      data: {
        userId,
        planId: plan.id,
        expiresAt: new Date(Date.now() + plan.durationDays * 24 * 3600_000),
      },
    });
  }

  private async invalidateVacancyCache(vacancyId: string): Promise<void> {
    const v = await this.prisma.vacancy.findUnique({
      where: { id: vacancyId },
      select: { regionId: true },
    });
    await this.cache.del(`vacancies:detail:${vacancyId}`);
    if (v) await this.cache.delPattern(`vacancies:list:${v.regionId}:*`);
    await this.cache.delPattern('vacancies:list:all:*');
  }

  // ===================== Foydalanuvchi obunasi =====================

  async mySubscription(userId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { userId, active: true, expiresAt: { gt: new Date() } },
      include: { plan: true },
      orderBy: { expiresAt: 'desc' },
    });
    return sub ?? null;
  }

  // ===================== Admin: to'lovlar va daromad =====================

  async listPayments(status?: string, limit = 50) {
    return this.prisma.payment.findMany({
      where: status ? { status: status as PaymentStatus } : {},
      include: { user: { select: { username: true, firstName: true, tgUserId: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async revenue() {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    since.setHours(0, 0, 0, 0);

    const [paidAgg, pendingCount, daily, byPurpose] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { status: PaymentStatus.PAID },
        _sum: { amountUzs: true },
        _count: { _all: true },
      }),
      this.prisma.payment.count({ where: { status: PaymentStatus.PENDING } }),
      this.prisma.$queryRaw<Array<{ day: Date; sum: bigint }>>`
        SELECT date_trunc('day', "paidAt") AS day, sum("amountUzs") AS sum
        FROM "payments" WHERE "status" = 'PAID' AND "paidAt" >= ${since}
        GROUP BY 1 ORDER BY 1`,
      this.prisma.payment.groupBy({
        by: ['purpose'],
        where: { status: PaymentStatus.PAID },
        _sum: { amountUzs: true },
        _count: { _all: true },
      }),
    ]);

    return {
      totalRevenue: paidAgg._sum.amountUzs ?? 0,
      paidCount: paidAgg._count._all,
      pendingCount,
      daily: daily.map((d) => ({ day: d.day, sum: Number(d.sum) })),
      byPurpose: byPurpose.map((p) => ({
        purpose: p.purpose,
        sum: p._sum.amountUzs ?? 0,
        count: p._count._all,
      })),
    };
  }

  /** Har kuni 04:00 — muddati o'tgan featured va obunalarni tozalash */
  @Cron('0 4 * * *')
  async expirePromotionsCron(): Promise<void> {
    const r = await this.expirePromotions();
    this.logger.log(`Expired: ${r.vacancies} featured, ${r.subs} obuna`);
  }

  /** Scheduler: muddati o'tgan featured va obunalarni tozalash */
  async expirePromotions(): Promise<{ vacancies: number; subs: number }> {
    const now = new Date();
    const vac = await this.prisma.vacancy.updateMany({
      where: { featured: true, promotedUntil: { lt: now } },
      data: { featured: false },
    });
    const subs = await this.prisma.subscription.updateMany({
      where: { active: true, expiresAt: { lt: now } },
      data: { active: false },
    });
    return { vacancies: vac.count, subs: subs.count };
  }
}
