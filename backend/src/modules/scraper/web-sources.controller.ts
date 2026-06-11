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
import { IsEnum } from 'class-validator';
import { Role, WebSourceStatus } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { WebSourcesService } from './web-sources.service';
import { CreateWebSourceDto } from './dto/create-web-source.dto';
import { ListChannelsDto } from '../channels/dto/list-channels.dto';

class UpdateWebSourceStatusDto {
  @ApiProperty({ enum: WebSourceStatus })
  @IsEnum(WebSourceStatus)
  status!: WebSourceStatus;
}

@ApiTags('web-sources')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('web-sources')
export class WebSourcesController {
  constructor(private readonly service: WebSourcesService) {}

  @Post()
  @ApiOperation({ summary: 'Vakansiya sayti manbasini qo`shish (RSS yoki HTML)' })
  create(@Body() dto: CreateWebSourceDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Manbalar ro`yxati (cursor)' })
  list(@Query() query: ListChannelsDto) {
    return this.service.list(query.cursor, query.limit);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Pause/resume' })
  setStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateWebSourceStatusDto) {
    return this.service.setStatus(id, dto.status);
  }

  @Post(':id/scrape')
  @ApiOperation({ summary: 'Hozir skanerlash (qo`lda trigger)' })
  scrapeNow(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.triggerNow(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Manbani o`chirish (soft delete)' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.service.remove(id);
  }
}
