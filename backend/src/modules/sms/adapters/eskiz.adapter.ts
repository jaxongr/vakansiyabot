import { Injectable, Logger } from '@nestjs/common';
import { SmsAdapter, SmsAdapterConfig, SmsSendResult } from './sms-adapter.interface';

const DEFAULT_BASE = 'https://notify.eskiz.uz/api';

/**
 * Eskiz.uz SMS gateway (O'zbekiston).
 * Auth: POST /auth/login (email+password) -> token (~30 kun amal qiladi).
 * Yuborish: POST /message/sms/send (Bearer token).
 * Hujjat: https://documenter.getpostman.com/view/663428/RzfmES4z
 */
@Injectable()
export class EskizAdapter implements SmsAdapter {
  readonly provider = 'ESKIZ';
  private readonly logger = new Logger(EskizAdapter.name);

  private base(config: SmsAdapterConfig): string {
    return config.baseUrl?.replace(/\/$/, '') || DEFAULT_BASE;
  }

  async ensureToken(
    config: SmsAdapterConfig,
  ): Promise<{ token: string; expiry: Date } | null> {
    // amaldagi token bo'lsa qayta olmaymiz
    if (config.token && config.tokenExpiry && config.tokenExpiry.getTime() > Date.now() + 3600_000) {
      return null;
    }
    if (!config.login || !config.password) return null;

    const form = new URLSearchParams();
    form.set('email', config.login);
    form.set('password', config.password);

    const res = await fetch(`${this.base(config)}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });
    if (!res.ok) {
      throw new Error(`Eskiz auth ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { data?: { token?: string } };
    const token = data.data?.token;
    if (!token) throw new Error('Eskiz token qaytmadi');
    // Eskiz token ~30 kun; ehtiyot uchun 25 kun
    return { token, expiry: new Date(Date.now() + 25 * 24 * 3600_000) };
  }

  async send(
    config: SmsAdapterConfig,
    phone: string,
    text: string,
  ): Promise<SmsSendResult> {
    if (!config.token) return { ok: false, error: 'Token yo`q (avval auth qiling)' };

    const form = new URLSearchParams();
    form.set('mobile_phone', phone.replace(/\D/g, ''));
    form.set('message', text);
    if (config.sender) form.set('from', config.sender);

    try {
      const res = await fetch(`${this.base(config)}/message/sms/send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form,
      });
      const body = (await res.json()) as { id?: string | number; message?: string; status?: string };
      if (!res.ok) return { ok: false, error: body.message ?? `HTTP ${res.status}` };
      return { ok: true, providerMessageId: body.id != null ? String(body.id) : undefined };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  async balance(config: SmsAdapterConfig): Promise<number | null> {
    if (!config.token) return null;
    try {
      const res = await fetch(`${this.base(config)}/user/get-limit`, {
        headers: { Authorization: `Bearer ${config.token}` },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { data?: { balance?: number } };
      return data.data?.balance ?? null;
    } catch {
      return null;
    }
  }
}
