import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { ChannelsService } from './channels.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { ListChannelsDto } from './dto/list-channels.dto';
import { VACANCY_CHANNELS } from './vacancy-channels';

class BulkImportDto {
  @ApiProperty({ type: [String], description: 'username yoki t.me havola ro`yxati' })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  usernames!: string[];
}

@ApiTags('channels')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('channels')
export class ChannelsController {
  constructor(private readonly channels: ChannelsService) {}

  @Post()
  @ApiOperation({ summary: 'Kanal qo`shish (collector join qiladi)' })
  create(@Body() dto: CreateChannelDto) {
    return this.channels.create(dto.username);
  }

  @Get()
  @ApiOperation({ summary: 'Kanallar ro`yxati (cursor pagination)' })
  list(@Query() query: ListChannelsDto) {
    return this.channels.list(query.cursor, query.limit);
  }

  @Post('bulk-import')
  @ApiOperation({ summary: 'Ko`plab kanalni bittada qo`shish (username/havola ro`yxati)' })
  bulkImport(@Body() dto: BulkImportDto) {
    return this.channels.bulkImport(dto.usernames);
  }

  @Post('import-seed')
  @ApiOperation({ summary: 'Tayyor O`zbekiston vakansiya kanallarini import qilish' })
  importSeed() {
    return this.channels.bulkImport(VACANCY_CHANNELS.map((c) => c.username));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Pause/resume' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateChannelDto) {
    return this.channels.update(id, dto.status);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Kanalni o`chirish (soft delete + leave)' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.channels.remove(id);
  }
}
