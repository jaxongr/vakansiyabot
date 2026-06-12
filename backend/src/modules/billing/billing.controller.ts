import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaymentProvider, Role } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { BillingService } from './billing.service';

class SubscribeDto {
  @ApiProperty() @IsString() planCode!: string;
  @ApiPropertyOptional({ enum: PaymentProvider })
  @IsOptional()
  @IsEnum(PaymentProvider)
  provider?: PaymentProvider;
}

class FeatureDto {
  @ApiPropertyOptional({ enum: PaymentProvider })
  @IsOptional()
  @IsEnum(PaymentProvider)
  provider?: PaymentProvider;
}

@ApiTags('billing')
@Controller()
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('plans')
  @Public()
  @ApiOperation({ summary: 'Tarif rejalari' })
  plans() {
    return this.billing.plans();
  }

  @Get('me/subscription')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Joriy obuna' })
  mySubscription(@CurrentUser() user: JwtPayload) {
    return this.billing.mySubscription(user.sub);
  }

  @Post('billing/subscribe')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tarifga obuna — checkout' })
  subscribe(@CurrentUser() user: JwtPayload, @Body() dto: SubscribeDto) {
    return this.billing.subscribeCheckout(
      user.sub,
      dto.planCode,
      dto.provider ?? PaymentProvider.MANUAL,
    );
  }

  @Post('billing/feature/vacancy/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Vakansiyani featured qilish — checkout' })
  featureVacancy(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FeatureDto,
  ) {
    return this.billing.featureVacancyCheckout(
      user.sub,
      id,
      dto.provider ?? PaymentProvider.MANUAL,
    );
  }

  // ===================== Admin =====================

  @Get('billing/payments')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'To`lovlar ro`yxati (admin)' })
  payments(@Query('status') status?: string) {
    return this.billing.listPayments(status);
  }

  @Post('billing/payments/:id/confirm')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'To`lovni qo`lda tasdiqlash (admin)' })
  confirm(@Param('id', ParseUUIDPipe) id: string) {
    return this.billing.confirmPayment(id);
  }

  @Get('billing/revenue')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Daromad statistikasi (admin)' })
  revenue() {
    return this.billing.revenue();
  }
}
