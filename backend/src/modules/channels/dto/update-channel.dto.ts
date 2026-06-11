import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ChannelStatus } from '@prisma/client';

export class UpdateChannelDto {
  @ApiProperty({ enum: ChannelStatus, example: ChannelStatus.PAUSED })
  @IsEnum(ChannelStatus)
  status!: ChannelStatus;
}
