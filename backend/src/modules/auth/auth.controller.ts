import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';

class MiniAppLoginDto {
  @ApiProperty({ description: 'Telegram WebApp initData (raw querystring)' })
  @IsString()
  @IsNotEmpty()
  initData!: string;
}

class TelegramLoginDto {
  @ApiProperty() @IsNumber() id!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() first_name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() username?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() photo_url?: string;
  @ApiProperty() @IsNumber() auth_date!: number;
  @ApiProperty() @IsString() hash!: string;
}

class RefreshDto {
  @ApiProperty() @IsString() @IsNotEmpty() refreshToken!: string;
}

@ApiTags('auth')
@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('miniapp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mini App: initData -> JWT (E4001)' })
  loginMiniApp(@Body() dto: MiniAppLoginDto) {
    return this.auth.loginWithInitData(dto.initData);
  }

  @Post('telegram-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Dashboard: Telegram Login Widget -> JWT (ADMIN_TG_IDS, E1002)' })
  loginTelegram(@Body() dto: TelegramLoginDto) {
    return this.auth.loginWithTelegramWidget(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh token rotation' })
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }
}
