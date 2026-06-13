import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApplicationStatus } from '@prisma/client';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { ApplicationsService } from './applications.service';

class ApplyDto {
  @ApiProperty() @IsUUID() vacancyId!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() resumeId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) coverNote?: string;
}

class StatusDto {
  @ApiProperty({ enum: ApplicationStatus })
  @IsEnum(ApplicationStatus)
  status!: ApplicationStatus;
}

@ApiTags('applications')
@ApiBearerAuth()
@Controller()
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Post('applications')
  @ApiOperation({ summary: 'Vakansiyaga ariza topshirish' })
  apply(@CurrentUser() user: JwtPayload, @Body() dto: ApplyDto) {
    return this.applications.apply(user.sub, dto);
  }

  @Get('me/applications')
  @ApiOperation({ summary: 'Mening arizalarim (ish izlovchi)' })
  mine(@CurrentUser() user: JwtPayload) {
    return this.applications.myApplications(user.sub);
  }

  @Get('vacancies/:id/applications')
  @ApiOperation({ summary: 'Vakansiyaga kelgan arizalar (ish beruvchi/admin)' })
  forVacancy(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.applications.applicationsForVacancy(id, user.sub, user.role);
  }

  @Patch('applications/:id/status')
  @ApiOperation({ summary: 'Ariza holatini o`zgartirish (shortlist/rad/qabul)' })
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: StatusDto,
  ) {
    return this.applications.setStatus(id, user.sub, user.role, dto.status);
  }
}
