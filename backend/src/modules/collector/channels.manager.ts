import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Api, TelegramClient } from 'telegram';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';

export interface JoinedChannelInfo {
  tgId: bigint;
  title: string;
  username: string | null;
  isGroup: boolean;
}

/** Joinlar orasidagi minimal tanaffus (FloodWait himoya) */
const MIN_JOIN_INTERVAL_MS = 30_000;
const JOIN_JITTER_MS = 30_000;

@Injectable()
export class ChannelsManager {
  private readonly logger = new Logger(ChannelsManager.name);
  private client: TelegramClient | null = null;
  private lastJoinAt = 0;
  private joinChain: Promise<unknown> = Promise.resolve();

  setClient(client: TelegramClient | null): void {
    this.client = client;
  }

  get isReady(): boolean {
    return this.client !== null;
  }

  /**
   * Kanalga qo'shilish. Joinlar ketma-ket, orasi 30-60s.
   * FloodWait kelsa error.seconds ga rioya qilinadi (qisqa bo'lsa kutadi).
   */
  async join(username: string): Promise<JoinedChannelInfo> {
    const client = this.requireClient();
    const result = this.joinChain.then(async () => {
      await this.respectJoinInterval();
      try {
        const updates = await client.invoke(new Api.channels.JoinChannel({ channel: username }));
        this.lastJoinAt = Date.now();
        return this.extractChannelInfo(updates);
      } catch (error) {
        this.lastJoinAt = Date.now();
        throw this.mapJoinError(error, username);
      }
    });
    // zanjir uzilmasligi uchun xatoni yutamiz, asl promise esa tashlaydi
    this.joinChain = result.catch(() => undefined);
    return result;
  }

  async leave(tgId: bigint): Promise<void> {
    if (!this.client) return; // demo rejimda jim chiqamiz
    try {
      const entity = await this.client.getEntity(tgId.toString());
      await this.client.invoke(new Api.channels.LeaveChannel({ channel: entity }));
    } catch (error) {
      this.logger.warn(`Leave failed for ${tgId}: ${(error as Error).message}`);
    }
  }

  private requireClient(): TelegramClient {
    if (!this.client) {
      throw new AppException(
        ErrorCode.COLLECTOR_SESSION_INVALID,
        "Collector sessiyasi sozlanmagan (TG_SESSION bo'sh) — kanalga join qilib bo'lmaydi",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return this.client;
  }

  private async respectJoinInterval(): Promise<void> {
    const since = Date.now() - this.lastJoinAt;
    const required = MIN_JOIN_INTERVAL_MS + Math.floor(Math.random() * JOIN_JITTER_MS);
    if (this.lastJoinAt > 0 && since < required) {
      await this.sleep(required - since);
    }
  }

  private extractChannelInfo(updates: Api.TypeUpdates): JoinedChannelInfo {
    const chats = 'chats' in updates ? updates.chats : [];
    const channel = chats.find((c): c is Api.Channel => c instanceof Api.Channel);
    if (!channel) {
      throw new AppException(
        ErrorCode.CHANNEL_JOIN_FAILED,
        'Telegram javobidan kanal ma`lumotini olib bo`lmadi',
        HttpStatus.BAD_GATEWAY,
      );
    }
    return {
      tgId: BigInt(channel.id.toString()),
      title: channel.title,
      username: channel.username ?? null,
      isGroup: channel.megagroup === true,
    };
  }

  private mapJoinError(error: unknown, username: string): AppException {
    const err = error as { errorMessage?: string; seconds?: number; message?: string };
    if (err.errorMessage === 'FLOOD' || err.errorMessage?.startsWith('FLOOD_WAIT')) {
      return new AppException(
        ErrorCode.CHANNEL_JOIN_FAILED,
        `FloodWait: ${err.seconds ?? '?'}s dan keyin qayta urinib ko'ring`,
        HttpStatus.TOO_MANY_REQUESTS,
        { retryAfterSeconds: err.seconds },
      );
    }
    return new AppException(
      ErrorCode.CHANNEL_JOIN_FAILED,
      `"${username}" kanaliga qo'shilib bo'lmadi: ${err.errorMessage ?? err.message ?? 'noma`lum xato'}`,
      HttpStatus.BAD_GATEWAY,
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
