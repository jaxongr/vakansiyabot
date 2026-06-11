import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { AppUser, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { parseAdminIds } from '../../config/configuration';
import { JwtPayload } from '../../common/decorators/current-user.decorator';

const INIT_DATA_MAX_AGE_SECONDS = 3600; // 1 soat

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface TelegramLoginPayload {
  id: number;
  first_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ===================== Mini App initData =====================

  /** Telegram WebApp initData HMAC tekshiruvi (E4001) */
  async loginWithInitData(initData: string): Promise<TokenPair & { user: SafeUser }> {
    const botToken = this.config.get<string>('BOT_TOKEN');
    if (!botToken) {
      throw new AppException(
        ErrorCode.INVALID_INIT_DATA,
        'BOT_TOKEN sozlanmagan',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) throw this.invalidInitData('hash maydoni yo`q');
    params.delete('hash');

    const dataCheckString = [...params.entries()]
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join('\n');

    const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
    const computed = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    if (!this.safeEqual(computed, hash)) throw this.invalidInitData('HMAC mos emas');

    const authDate = Number(params.get('auth_date') ?? 0);
    if (!authDate || Date.now() / 1000 - authDate > INIT_DATA_MAX_AGE_SECONDS) {
      throw this.invalidInitData('auth_date eskirgan (1 soatdan ortiq)');
    }

    const userJson = params.get('user');
    if (!userJson) throw this.invalidInitData('user maydoni yo`q');
    const tgUser = JSON.parse(userJson) as {
      id: number;
      first_name?: string;
      username?: string;
    };

    const user = await this.upsertUser(tgUser.id, tgUser.username, tgUser.first_name);
    const tokens = await this.issueTokens(user);
    return { ...tokens, user: this.safeUser(user) };
  }

  // ===================== Dashboard Telegram Login =====================

  /** Telegram Login Widget tekshiruvi + ADMIN_TG_IDS (E1002) */
  async loginWithTelegramWidget(payload: TelegramLoginPayload): Promise<TokenPair & { user: SafeUser }> {
    const botToken = this.config.get<string>('BOT_TOKEN');
    if (!botToken) {
      throw new AppException(
        ErrorCode.UNAUTHORIZED,
        'BOT_TOKEN sozlanmagan',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const { hash, ...fields } = payload;
    const dataCheckString = Object.entries(fields)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join('\n');

    const secretKey = createHash('sha256').update(botToken).digest();
    const computed = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    if (!this.safeEqual(computed, hash)) {
      throw AppException.unauthorized('Telegram login imzosi noto`g`ri');
    }
    if (Date.now() / 1000 - payload.auth_date > 86_400) {
      throw AppException.unauthorized('Login sessiyasi eskirgan');
    }

    const adminIds = parseAdminIds(this.config.get<string>('ADMIN_TG_IDS', ''));
    if (!adminIds.includes(payload.id)) {
      throw AppException.forbidden('Siz admin emassiz'); // E1002
    }

    const user = await this.upsertUser(payload.id, payload.username, payload.first_name, Role.ADMIN);
    const tokens = await this.issueTokens(user);
    return { ...tokens, user: this.safeUser(user) };
  }

  // ===================== Refresh rotation =====================

  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw AppException.unauthorized('Refresh token yaroqsiz');
    }

    const user = await this.prisma.appUser.findUnique({ where: { id: payload.sub } });
    if (!user || user.deletedAt) throw AppException.unauthorized('Foydalanuvchi topilmadi');

    // rotation: saqlangan hash bilan solishtiramiz
    const tokenHash = this.hashToken(refreshToken);
    if (user.refreshTokenHash !== tokenHash) {
      // o'g'irlangan/eski token — barcha sessiyalarni bekor qilamiz
      await this.prisma.appUser.update({
        where: { id: user.id },
        data: { refreshTokenHash: null },
      });
      throw AppException.unauthorized('Refresh token allaqachon ishlatilgan');
    }

    return this.issueTokens(user);
  }

  // ===================== ichki =====================

  private async upsertUser(
    tgUserId: number,
    username?: string,
    firstName?: string,
    role?: Role,
  ): Promise<AppUser> {
    return this.prisma.appUser.upsert({
      where: { tgUserId: BigInt(tgUserId) },
      update: { username, firstName, ...(role ? { role } : {}) },
      create: { tgUserId: BigInt(tgUserId), username, firstName, role: role ?? Role.USER },
    });
  }

  private async issueTokens(user: AppUser): Promise<TokenPair> {
    const payload: JwtPayload = {
      sub: user.id,
      tgUserId: user.tgUserId.toString(),
      role: user.role,
    };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: '15m',
    });
    // jti — har refresh tokenni noyob qiladi (rotation bir sekund ichida ham ishlasin)
    const refreshToken = await this.jwt.signAsync(
      { ...payload, jti: randomUUID() },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      },
    );
    await this.prisma.appUser.update({
      where: { id: user.id },
      data: { refreshTokenHash: this.hashToken(refreshToken) },
    });
    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
  }

  private invalidInitData(reason: string): AppException {
    return new AppException(
      ErrorCode.INVALID_INIT_DATA,
      `initData yaroqsiz: ${reason}`,
      HttpStatus.UNAUTHORIZED,
    );
  }

  private safeUser(user: AppUser): SafeUser {
    return {
      id: user.id,
      tgUserId: user.tgUserId.toString(),
      username: user.username,
      firstName: user.firstName,
      regionId: user.regionId,
      role: user.role,
    };
  }
}

export interface SafeUser {
  id: string;
  tgUserId: string;
  username: string | null;
  firstName: string | null;
  regionId: string | null;
  role: Role;
}
