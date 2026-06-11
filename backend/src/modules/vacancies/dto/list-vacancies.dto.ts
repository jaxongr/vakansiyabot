import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { EmploymentType } from '@prisma/client';

export class ListVacanciesDto {
  @ApiPropertyOptional() @IsOptional() @IsString() cursor?: string;

  @ApiPropertyOptional({ default: 20, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @ApiPropertyOptional() @IsOptional() @IsUUID() regionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string;

  @ApiPropertyOptional({ description: 'Minimal maosh (UZS)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  salaryMin?: number;

  @ApiPropertyOptional({ enum: EmploymentType })
  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @ApiPropertyOptional({ description: 'Full-text qidiruv (tsvector)' })
  @IsOptional()
  @IsString()
  q?: string;
}
