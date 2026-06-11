import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { DedupReviewService } from './dedup-review.service';
import { ListChannelsDto } from '../channels/dto/list-channels.dto';

class ResolveReviewDto {
  @ApiProperty({ enum: ['merge', 'separate'] })
  @IsIn(['merge', 'separate'])
  action!: 'merge' | 'separate';
}

@ApiTags('dedup')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('dedup/review')
export class DedupReviewController {
  constructor(private readonly service: DedupReviewService) {}

  @Get()
  @ApiOperation({ summary: 'Shubhali juftliklar (PENDING)' })
  list(@Query() query: ListChannelsDto) {
    return this.service.list(query.cursor, query.limit);
  }

  @Post(':id')
  @ApiOperation({ summary: 'Merge (B -> A birlashtirish) yoki Separate' })
  resolve(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ResolveReviewDto) {
    return this.service.resolve(id, dto.action);
  }
}
