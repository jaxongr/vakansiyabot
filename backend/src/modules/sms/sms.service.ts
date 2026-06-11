import { Injectable, Logger } from '@nestjs/common';
import { SmsProvider, SmsSetting, SmsStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SystemStatusService } from '../system/system-status.service';
import { EskizAdapter } from './adapters/eskiz.adapter';
import { PlayMobileAdapter } from './adapters/playmobile.adapter';
import { SmsAdapter } from './adapters/sms-adapter.interface';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly status: SystemStatusService,
    private readonly eskiz: EskizAdapter,
    private readonly playmobile: PlayMobileAdapter,
  ) {}

  private adapterFor(provider: SmsProvider): SmsAdapter {
    return provider === SmsProvider.PLAYMOBILE ? this.playmobile : this.eskiz;
  }

  /** Yagona sozlama qatori (bo'lmasa yaratiladi) */
  async getSettings(): Promise<SmsSetting> {
    const existing = await this.prisma.smsSetting.findFirst();
    if (existing) return existing;
    return this.prisma.smsSetting.create({ data: {} });
  }

  get isConfigured(): Promise<boolean> {
    return this.getSettings().then((s) => s.enabled && Boolean(s.login));
  }

  async updateSettings(data: Partial<SmsSetting>): Promise<SmsSetting> {
    const current = await this.getSettings();
    // login/parol o'zgarsa keshlangan tokenni bekor qilamiz
    const resetToken =
      (data.login !== undefined && data.login !== current.login) ||
      (data.password !== undefined && data.password !== current.password) ||
      (data.provider !== undefined && data.provider !== current.provider);

    const updated = await this.prisma.smsSetting.update({
      where: { id: current.id },
      data: { ...data, ...(resetToken ? { token: null, tokenExpiry: null } : {}) },
    });
    this.refreshStatus(updated);
    return updated;
  }

  /** Token tekshirib/yangilab, bitta SMS yuboradi va jurnalga yozadi */
  async send(phone: string, text: string): Promise<{ ok: boolean; error?: string }> {
    const settings = await this.getSettings();
    if (!settings.enabled) return { ok: false, error: 'SMS o`chirilgan (sozlamalardan yoqing)' };

    const adapter = this.adapterFor(settings.provider);
    let config = settings;

    // token kerak bo'lsa yangilaymiz (Eskiz)
    if (adapter.ensureToken) {
      try {
        const fresh = await adapter.ensureToken(settings);
        if (fresh) {
          config = await this.prisma.smsSetting.update({
            where: { id: settings.id },
            data: { token: fresh.token, tokenExpiry: fresh.expiry },
          });
        }
      } catch (e) {
        const error = (e as Error).message;
        this.logger.error(`SMS auth failed: ${error}`);
        await this.log(phone, text, SmsStatus.FAILED, undefined, error);
        return { ok: false, error };
      }
    }

    const result = await adapter.send(config, phone, text);
    await this.log(
      phone,
      text,
      result.ok ? SmsStatus.SENT : SmsStatus.FAILED,
      result.providerMessageId,
      result.error,
    );
    return { ok: result.ok, error: result.error };
  }

  async checkBalance(): Promise<number | null> {
    const settings = await this.getSettings();
    const adapter = this.adapterFor(settings.provider);
    if (!adapter.balance) return null;
    let config = settings;
    if (adapter.ensureToken) {
      const fresh = await adapter.ensureToken(settings).catch(() => null);
      if (fresh) {
        config = await this.prisma.smsSetting.update({
          where: { id: settings.id },
          data: { token: fresh.token, tokenExpiry: fresh.expiry },
        });
      }
    }
    const balance = await adapter.balance(config);
    if (balance !== null) {
      await this.prisma.smsSetting.update({ where: { id: settings.id }, data: { balance } });
    }
    return balance;
  }

  async logs(limit = 50) {
    return this.prisma.smsLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
  }

  private async log(
    phone: string,
    text: string,
    status: SmsStatus,
    providerMessageId?: string,
    error?: string,
  ): Promise<void> {
    await this.prisma.smsLog.create({
      data: { phone, text, status, providerMessageId, error },
    });
  }

  private refreshStatus(s: SmsSetting): void {
    this.status.set(
      'sms',
      s.enabled ? (s.login ? 'OK' : 'DEGRADED') : 'DISABLED',
      s.enabled ? `Provider: ${s.provider}` : 'SMS o`chirilgan',
    );
  }
}
