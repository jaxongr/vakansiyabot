import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class CreateChannelDto {
  @ApiProperty({ example: 'ishbor_uz', description: 'Kanal username (@siz ham bo`ladi)' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^@?[a-zA-Z][a-zA-Z0-9_]{3,31}$/, { message: 'username formati noto`g`ri' })
  username!: string;
}
