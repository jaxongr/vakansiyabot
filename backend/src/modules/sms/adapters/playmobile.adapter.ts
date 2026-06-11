import { Injectable } from '@nestjs/common';
import { SmsAdapter, SmsAdapterConfig, SmsSendResult } from './sms-adapter.interface';

const DEFAULT_BASE = 'https://send.smsxabar.uz/broker-api';

/**
 * Play Mobile (smsxabar.uz) — O'zbekiston SMS gateway.
 * Auth: Basic (login:password). Yuborish: POST /send JSON.
 */
@Injectable()
export class PlayMobileAdapter implements SmsAdapter {
  readonly provider = 'PLAYMOBILE';

  private base(config: SmsAdapterConfig): string {
    return config.baseUrl?.replace(/\/$/, '') || DEFAULT_BASE;
  }

  async send(
    config: SmsAdapterConfig,
    phone: string,
    text: string,
  ): Promise<SmsSendResult> {
    if (!config.login || !config.password) return { ok: false, error: 'login/parol yo`q' };

    const auth = Buffer.from(`${config.login}:${config.password}`).toString('base64');
    const messageId = `${Date.now()}`;
    const payload = {
      messages: [
        {
          'message-id': messageId,
          recipient: phone.replace(/\D/g, ''),
          sms: { originator: config.sender || '3700', content: { text } },
        },
      ],
    };

    try {
      const res = await fetch(`${this.base(config)}/send`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${await res.text()}` };
      return { ok: true, providerMessageId: messageId };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }
}
