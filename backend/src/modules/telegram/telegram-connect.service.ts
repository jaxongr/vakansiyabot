import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Api, TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { computeCheck } from 'telegram/Password';
import { TelegramSetting } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CollectorService } from '../collector/collector.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';

interface PendingLogin {
  client: TelegramClient;
  phone: string;
  phoneCodeHash: string;
  apiId: number;
  apiHash: string;
  createdAt: number;
}

const LOGIN_TTL_MS = 5 * 60_000;

@Injectable()
export class TelegramConnectService {
  private readonly logger = new Logger(TelegramConnectService.name);
  private readonly pending = new Map<string, PendingLogin>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly collector: CollectorService,
  ) {}

  async getSettings(): Promise<TelegramSetting> {
    const existing = await this.prisma.telegramSetting.findFirst();
    if (existing) return existing;
    return this.prisma.telegramSetting.create({ data: {} });
  }

  /** Bot sozlamalari (token/guruh/adminlar) — restartda qo'llanadi */
  async updateBotSettings(data: {
    botToken?: string;
    botUsername?: string;
    publishGroupId?: string;
    adminIds?: string;
  }): Promise<TelegramSetting> {
    const current = await this.getSettings();
    return this.prisma.telegramSetting.update({ where: { id: current.id }, data });
  }

  // ===================== Collector login oqimi =====================

  /** 1-qadam: telefon raqamga kod yuborish */
  async startLogin(apiId: number, apiHash: string, phone: string): Promise<{ loginId: string }> {
    this.cleanupExpired();
    const client = new TelegramClient(new StringSession(''), apiId, apiHash, {
      connectionRetries: 3,
    });
    await client.connect();

    try {
      const result = await client.sendCode({ apiId, apiHash }, phone);
      const loginId = randomUUID();
      this.pending.set(loginId, {
        client,
        phone,
        phoneCodeHash: result.phoneCodeHash,
        apiId,
        apiHash,
        createdAt: Date.now(),
      });
      return { loginId };
    } catch (error) {
      await client.disconnect().catch(() => undefined);
      throw new AppException(
        ErrorCode.COLLECTOR_SESSION_INVALID,
        `Kod yuborilmadi: ${(error as Error).message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /** 2-qadam: kod (va kerak bo'lsa 2FA parol) bilan tasdiqlash -> sessiya saqlash */
  async confirmCode(
    loginId: string,
    code: string,
    password?: string,
  ): Promise<{ ok: true; session: string }> {
    const pending = this.pending.get(loginId);
    if (!pending) {
      throw new AppException(
        ErrorCode.COLLECTOR_SESSION_INVALID,
        'Login sessiyasi topilmadi yoki eskirgan — qaytadan boshlang',
        HttpStatus.BAD_REQUEST,
      );
    }
    const { client, phone, phoneCodeHash, apiId, apiHash } = pending;

    try {
      try {
        await client.invoke(
          new Api.auth.SignIn({ phoneNumber: phone, phoneCodeHash, phoneCode: code }),
        );
      } catch (error) {
        const msg = (error as { errorMessage?: string }).errorMessage ?? (error as Error).message;
        if (msg?.includes('SESSION_PASSWORD_NEEDED')) {
          if (!password) {
            throw new AppException(
              ErrorCode.COLLECTOR_SESSION_INVALID,
              '2FA parol kerak — parolni kiriting',
              HttpStatus.BAD_REQUEST,
              { needPassword: true },
            );
          }
          const pwd = await client.invoke(new Api.account.GetPassword());
          const check = await computeCheck(pwd, password);
          await client.invoke(new Api.auth.CheckPassword({ password: check }));
        } else {
          throw error;
        }
      }

      const session = String(client.session.save());
      const settings = await this.getSettings();
      await this.prisma.telegramSetting.update({
        where: { id: settings.id },
        data: {
          apiId,
          apiHash,
          session,
          collectorPhone: phone,
          collectorEnabled: true,
          collectorStatus: 'OK',
        },
      });

      await client.disconnect().catch(() => undefined);
      this.pending.delete(loginId);

      // collector'ni yangi sessiya bilan jonli qayta ulaymiz
      await this.collector.applySettings(apiId, apiHash, session);
      this.logger.log(`Collector ulandi: ${phone}`);
      return { ok: true, session };
    } catch (error) {
      if (error instanceof AppException) throw error;
      throw new AppException(
        ErrorCode.COLLECTOR_SESSION_INVALID,
        `Tasdiqlash xatosi: ${(error as Error).message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async disconnect(): Promise<void> {
    const settings = await this.getSettings();
    await this.prisma.telegramSetting.update({
      where: { id: settings.id },
      data: { collectorEnabled: false, collectorStatus: 'DISABLED' },
    });
    await this.collector.applySettings(null, null, null);
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [id, p] of this.pending.entries()) {
      if (now - p.createdAt > LOGIN_TTL_MS) {
        void p.client.disconnect().catch(() => undefined);
        this.pending.delete(id);
      }
    }
  }
}
