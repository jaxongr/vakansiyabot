import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { TelegramConnectService } from './telegram-connect.service';

class StartLoginDto {
  @ApiProperty() @Type(() => Number) @IsInt() apiId!: number;
  @ApiProperty() @IsString() @MinLength(10) apiHash!: string;
  @ApiProperty({ example: '+998901234567' }) @IsString() @MinLength(9) phone!: string;
}

class ConfirmCodeDto {
  @ApiProperty() @IsString() loginId!: string;
  @ApiProperty({ example: '12345' }) @IsString() code!: string;
  @ApiPropertyOptional({ description: '2FA parol (kerak bo`lsa)' })
  @IsOptional()
  @IsString()
  password?: string;
}

class BotSettingsDto {
  @ApiPropertyOptional() @IsOptional() @IsString() botToken?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() botUsername?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() publishGroupId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() adminIds?: string;
}

/** Telegram ulanish: collector userbot sessiyasi + publisher bot sozlamalari */
@ApiTags('telegram')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('telegram')
export class TelegramController {
  constructor(private readonly connect: TelegramConnectService) {}

  @Get('settings')
  @ApiOperation({ summary: 'Telegram sozlamalari (maxfiy maydonlar maskalangan)' })
  async settings() {
    const s = await this.connect.getSettings();
    return {
      apiId: s.apiId,
      apiHashSet: Boolean(s.apiHash),
      sessionSet: Boolean(s.session),
      collectorPhone: s.collectorPhone,
      collectorEnabled: s.collectorEnabled,
      collectorStatus: s.collectorStatus,
      botTokenSet: Boolean(s.botToken),
      botUsername: s.botUsername,
      publishGroupId: s.publishGroupId,
      adminIds: s.adminIds,
    };
  }

  @Post('collector/start-login')
  @ApiOperation({ summary: 'Collector: telefon raqamga kod yuborish' })
  startLogin(@Body() dto: StartLoginDto) {
    return this.connect.startLogin(dto.apiId, dto.apiHash, dto.phone);
  }

  @Post('collector/confirm-code')
  @ApiOperation({ summary: 'Collector: kod (va 2FA) bilan ulanish' })
  confirmCode(@Body() dto: ConfirmCodeDto) {
    return this.connect.confirmCode(dto.loginId, dto.code, dto.password);
  }

  @Post('collector/disconnect')
  @ApiOperation({ summary: 'Collector ulanishini uzish' })
  disconnect() {
    return this.connect.disconnect();
  }

  @Patch('bot')
  @ApiOperation({ summary: 'Bot sozlamalari (token/guruh/adminlar) — restartda qo`llanadi' })
  updateBot(@Body() dto: BotSettingsDto) {
    return this.connect.updateBotSettings(dto);
  }
}
