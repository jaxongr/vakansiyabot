import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min } from 'class-validator';
import { WebSourceType } from '@prisma/client';

export class CreateWebSourceDto {
  @ApiProperty({ enum: WebSourceType })
  @IsEnum(WebSourceType)
  type!: WebSourceType;

  @ApiProperty({ example: 'ish.uz IT vakansiyalari' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'https://ish.uz/rss' })
  @IsUrl({ require_protocol: true })
  url!: string;

  @ApiPropertyOptional({ default: 30, description: 'Skanerlash oraligi (daqiqa)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(1440)
  intervalMin?: number = 30;
}
