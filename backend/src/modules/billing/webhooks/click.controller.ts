/* eslint-disable @typescript-eslint/no-explicit-any */
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { Public } from '../../../common/decorators/public.decorator';
import { BillingService } from '../billing.service';

/**
 * Click Shop API: Prepare (action=0) + Complete (action=1).
 * Imzo: md5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id +
 *   [merchant_prepare_id] + amount + action + sign_time).
 * merchant_trans_id = bizning Payment.id.
 */
@ApiExcludeController()
@Public()
@Controller('webhooks/click')
export class ClickController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly billing: BillingService,
  ) {}

  @Post('prepare')
  @HttpCode(200)
  async prepare(@Body() b: any) {
    const err = this.verify(b, false);
    if (err) return err;
    const payment = await this.prisma.payment.findUnique({ where: { id: b.merchant_trans_id } });
    if (!payment) return this.resp(b, -5, 'Order not found');
    if (payment.amountUzs !== Math.round(Number(b.amount))) return this.resp(b, -2, 'Wrong amount');
    if (payment.status === PaymentStatus.PAID) return this.resp(b, -4, 'Already paid');

    return {
      click_trans_id: b.click_trans_id,
      merchant_trans_id: b.merchant_trans_id,
      merchant_prepare_id: payment.id,
      error: 0,
      error_note: 'Success',
    };
  }

  @Post('complete')
  @HttpCode(200)
  async complete(@Body() b: any) {
    const err = this.verify(b, true);
    if (err) return err;
    const payment = await this.prisma.payment.findUnique({ where: { id: b.merchant_trans_id } });
    if (!payment) return this.resp(b, -5, 'Order not found');
    if (Number(b.error) < 0) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED },
      });
      return this.resp(b, -9, 'Cancelled');
    }
    if (payment.status !== PaymentStatus.PAID) {
      await this.billing.confirmPayment(payment.id, String(b.click_trans_id));
    }
    return {
      click_trans_id: b.click_trans_id,
      merchant_trans_id: b.merchant_trans_id,
      merchant_confirm_id: payment.id,
      error: 0,
      error_note: 'Success',
    };
  }

  private verify(b: any, withPrepareId: boolean): { error: number; error_note: string } | null {
    const secret = this.config.get<string>('CLICK_SECRET_KEY');
    if (!secret) return { error: -8, error_note: 'Not configured' };
    const parts = [
      b.click_trans_id,
      b.service_id,
      secret,
      b.merchant_trans_id,
      ...(withPrepareId ? [b.merchant_prepare_id] : []),
      b.amount,
      b.action,
      b.sign_time,
    ];
    const expected = createHash('md5').update(parts.join('')).digest('hex');
    if (expected !== b.sign_string) return { error: -1, error_note: 'Imzo xato (SIGN CHECK FAILED)' };
    return null;
  }

  private resp(b: any, error: number, note: string) {
    return {
      click_trans_id: b.click_trans_id,
      merchant_trans_id: b.merchant_trans_id,
      error,
      error_note: note,
    };
  }
}
