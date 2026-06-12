/* eslint-disable @typescript-eslint/no-explicit-any */
import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { Public } from '../../../common/decorators/public.decorator';
import { BillingService } from '../billing.service';

/**
 * Payme Merchant API (JSON-RPC). Auth: Basic "Paycom:MERCHANT_KEY".
 * account.order_id = bizning Payment.id. Holat Payment.meta da saqlanadi.
 * Payme xato kodlari standartiga rioya qilinadi.
 */
const ERR = {
  AUTH: { code: -32504, message: 'Avtorizatsiya xatosi' },
  METHOD: { code: -32601, message: 'Metod topilmadi' },
  ORDER: { code: -31050, message: { uz: 'Buyurtma topilmadi', ru: 'Заказ не найден', en: 'Order not found' } },
  AMOUNT: { code: -31001, message: { uz: 'Summa noto`g`ri', ru: 'Неверная сумма', en: 'Wrong amount' } },
  TXN: { code: -31003, message: 'Tranzaksiya topilmadi' },
  CANNOT_PERFORM: { code: -31008, message: 'Operatsiyani bajarib bo`lmaydi' },
};

interface PaymeMeta {
  paymeId?: string;
  state?: number;
  createTime?: number;
  performTime?: number;
  cancelTime?: number;
  reason?: number;
}

@ApiExcludeController()
@Public()
@Controller('webhooks/payme')
export class PaymeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly billing: BillingService,
  ) {}

  @Post()
  @HttpCode(200)
  async handle(@Headers('authorization') auth: string | undefined, @Body() body: any) {
    if (!this.checkAuth(auth)) {
      return { error: ERR.AUTH, id: body?.id };
    }
    const { method, params, id } = body;
    try {
      switch (method) {
        case 'CheckPerformTransaction':
          return { result: await this.checkPerform(params), id };
        case 'CreateTransaction':
          return { result: await this.createTransaction(params), id };
        case 'PerformTransaction':
          return { result: await this.performTransaction(params), id };
        case 'CancelTransaction':
          return { result: await this.cancelTransaction(params), id };
        case 'CheckTransaction':
          return { result: await this.checkTransaction(params), id };
        default:
          return { error: ERR.METHOD, id };
      }
    } catch (e) {
      const err = e as { paymeError?: unknown };
      if (err.paymeError) return { error: err.paymeError, id };
      throw e;
    }
  }

  private checkAuth(auth?: string): boolean {
    const key = this.config.get<string>('PAYME_MERCHANT_KEY');
    if (!key) return false;
    if (!auth?.startsWith('Basic ')) return false;
    const decoded = Buffer.from(auth.slice(6), 'base64').toString();
    const [, pass] = decoded.split(':');
    return pass === key;
  }

  private fail(err: unknown): never {
    throw { paymeError: err };
  }

  private async loadOrder(orderId: string, amountTiyin?: number) {
    const payment = await this.prisma.payment.findUnique({ where: { id: orderId } });
    if (!payment) this.fail(ERR.ORDER);
    if (amountTiyin !== undefined && payment!.amountUzs * 100 !== amountTiyin) this.fail(ERR.AMOUNT);
    return payment!;
  }

  private async checkPerform(params: any) {
    await this.loadOrder(params.account?.order_id, params.amount);
    return { allow: true };
  }

  private async createTransaction(params: any) {
    const payment = await this.loadOrder(params.account?.order_id, params.amount);
    const meta = (payment.meta as PaymeMeta | null) ?? {};

    if (meta.paymeId && meta.paymeId !== params.id) this.fail(ERR.CANNOT_PERFORM);
    if (!meta.paymeId) {
      const createTime = params.time ?? Date.now();
      await this.saveMeta(payment.id, { paymeId: params.id, state: 1, createTime });
      return { create_time: createTime, transaction: payment.id, state: 1 };
    }
    return { create_time: meta.createTime, transaction: payment.id, state: meta.state };
  }

  private async performTransaction(params: any) {
    const payment = await this.byPaymeId(params.id);
    const meta = (payment.meta as PaymeMeta) ?? {};
    if (meta.state === 2) {
      return { transaction: payment.id, perform_time: meta.performTime, state: 2 };
    }
    if (meta.state !== 1) this.fail(ERR.CANNOT_PERFORM);

    const performTime = Date.now();
    await this.saveMeta(payment.id, { ...meta, state: 2, performTime });
    await this.billing.confirmPayment(payment.id, params.id); // featured/obuna faollashadi
    return { transaction: payment.id, perform_time: performTime, state: 2 };
  }

  private async cancelTransaction(params: any) {
    const payment = await this.byPaymeId(params.id);
    const meta = (payment.meta as PaymeMeta) ?? {};
    const cancelTime = Date.now();
    const state = meta.state === 2 ? -2 : -1;
    await this.saveMeta(payment.id, { ...meta, state, cancelTime, reason: params.reason });
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.REFUNDED },
    });
    return { transaction: payment.id, cancel_time: cancelTime, state };
  }

  private async checkTransaction(params: any) {
    const payment = await this.byPaymeId(params.id);
    const meta = (payment.meta as PaymeMeta) ?? {};
    return {
      create_time: meta.createTime ?? 0,
      perform_time: meta.performTime ?? 0,
      cancel_time: meta.cancelTime ?? 0,
      transaction: payment.id,
      state: meta.state ?? 0,
      reason: meta.reason ?? null,
    };
  }

  private async byPaymeId(paymeId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { meta: { path: ['paymeId'], equals: paymeId } },
    });
    if (!payment) this.fail(ERR.TXN);
    return payment!;
  }

  private async saveMeta(paymentId: string, meta: PaymeMeta): Promise<void> {
    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { meta: meta as unknown as Prisma.InputJsonValue },
    });
  }
}
