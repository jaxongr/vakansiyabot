import { PaymentProvider } from '@prisma/client';

/**
 * O'zbekiston to'lov provayderlari uchun checkout URL quruvchilar.
 * Payme/Click merchant kalitlari .env da bo'lsa ishlaydi; aks holda MANUAL.
 * Webhook (Payme JSON-RPC / Click) — keyin sozlanadi (PAYME_MERCHANT_ID...).
 */

export interface CheckoutResult {
  provider: PaymentProvider;
  checkoutUrl?: string;
  instructions?: string;
}

export function buildCheckout(
  provider: PaymentProvider,
  paymentId: string,
  amountUzs: number,
  env: { paymeMerchantId?: string; clickMerchantId?: string; clickServiceId?: string },
): CheckoutResult {
  const amountTiyin = amountUzs * 100;

  if (provider === PaymentProvider.PAYME && env.paymeMerchantId) {
    // Payme checkout: base64(m=merchant;ac.order_id=paymentId;a=amount_tiyin)
    const params = `m=${env.paymeMerchantId};ac.order_id=${paymentId};a=${amountTiyin}`;
    const encoded = Buffer.from(params).toString('base64');
    return { provider, checkoutUrl: `https://checkout.paycom.uz/${encoded}` };
  }

  if (provider === PaymentProvider.CLICK && env.clickMerchantId && env.clickServiceId) {
    const url =
      `https://my.click.uz/services/pay?service_id=${env.clickServiceId}` +
      `&merchant_id=${env.clickMerchantId}&amount=${amountUzs}&transaction_param=${paymentId}`;
    return { provider, checkoutUrl: url };
  }

  // MANUAL — admin tasdiqlaydi
  return {
    provider: PaymentProvider.MANUAL,
    instructions:
      `To'lov: ${amountUzs.toLocaleString('ru-RU')} so'm. ` +
      `Admin to'lovni tasdiqlagach faollashadi (ID: ${paymentId.slice(0, 8)}).`,
  };
}
