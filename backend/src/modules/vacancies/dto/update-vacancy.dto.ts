import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Currency, EmploymentType, VacancyStatus } from '@prisma/client';

/** Moderatsiya: edit (guruh posti ham yangilanadi) yoki hide */
export class UpdateVacancyDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(3) @MaxLength(120) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(10) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) company?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() regionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) salaryMin?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) salaryMax?: number;
  @ApiPropertyOptional({ enum: Currency }) @IsOptional() @IsEnum(Currency) currency?: Currency;
  @ApiPropertyOptional({ enum: EmploymentType })
  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() phones?: string[];
  @ApiPropertyOptional({ enum: VacancyStatus })
  @IsOptional()
  @IsEnum(VacancyStatus)
  status?: VacancyStatus;
}
