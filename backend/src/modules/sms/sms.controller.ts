import { Body, Controller, Get, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Role, SmsProvider } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { SmsService } from './sms.service';

class UpdateSmsDto {
  @ApiPropertyOptional({ enum: SmsProvider })
  @IsOptional()
  @IsEnum(SmsProvider)
  provider?: SmsProvider;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() enabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() login?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() password?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sender?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() baseUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() notifyOnPublish?: boolean;
}

class TestSmsDto {
  @ApiProperty({ example: '998901234567' })
  @IsString()
  @MinLength(9)
  phone!: string;

  @ApiProperty({ example: 'Test SMS' })
  @IsString()
  @MaxLength(500)
  text!: string;
}

class LogsQuery {
  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number = 50;
}

/** SMS yuborilganda parolni javobda qaytarmaymiz */
function maskSettings<T extends { password?: string | null; token?: string | null }>(s: T) {
  return {
    ...s,
    password: s.password ? '••••••••' : null,
    token: s.token ? 'set' : null,
  };
}

@ApiTags('sms')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('sms')
export class SmsController {
  constructor(private readonly sms: SmsService) {}

  @Get('settings')
  @ApiOperation({ summary: 'SMS sozlamalari (parol maskalangan)' })
  async settings() {
    return maskSettings(await this.sms.getSettings());
  }

  @Patch('settings')
  @ApiOperation({ summary: 'SMS sozlamalarini yangilash (provider, login, sender, yoqish)' })
  async update(@Body() dto: UpdateSmsDto) {
    return maskSettings(await this.sms.updateSettings(dto));
  }

  @Post('test')
  @ApiOperation({ summary: 'Test SMS yuborish' })
  test(@Body() dto: TestSmsDto) {
    return this.sms.send(dto.phone, dto.text);
  }

  @Get('balance')
  @ApiOperation({ summary: 'Provider balansi' })
  async balance() {
    return { balance: await this.sms.checkBalance() };
  }

  @Get('logs')
  @ApiOperation({ summary: 'Yuborilgan SMS jurnali' })
  logs(@Query() q: LogsQuery) {
    return this.sms.logs(q.limit);
  }
}
