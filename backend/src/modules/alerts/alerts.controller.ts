import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { EmploymentType } from '@prisma/client';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { AlertsService } from './alerts.service';

class SaveSearchDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() regionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) salaryMin?: number;
  @ApiPropertyOptional({ enum: EmploymentType })
  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) q?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() notify?: boolean;
}

class NotifyDto {
  @ApiPropertyOptional() @IsBoolean() notify!: boolean;
}

@ApiTags('alerts')
@ApiBearerAuth()
@Controller('me/searches')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  @ApiOperation({ summary: 'Saqlangan qidiruvlar (Job Alert)' })
  list(@CurrentUser() user: JwtPayload) {
    return this.alerts.list(user.sub);
  }

  @Post()
  @ApiOperation({ summary: 'Qidiruvni saqlash — mos vakansiyada xabar olasiz' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: SaveSearchDto) {
    return this.alerts.create(user.sub, dto);
  }

  @Patch(':id/notify')
  @ApiOperation({ summary: 'Xabarnomani yoqish/o`chirish' })
  toggle(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: NotifyDto,
  ) {
    return this.alerts.toggleNotify(user.sub, id, dto.notify);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Saqlangan qidiruvni o`chirish' })
  remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.alerts.remove(user.sub, id);
  }
}
