import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { DiscoveryService } from './discovery.service';
import { ChannelsService } from '../channels/channels.service';

class ResolveDto {
  @ApiProperty({ enum: ['approve', 'reject'] })
  @IsIn(['approve', 'reject'])
  action!: 'approve' | 'reject';
}

@ApiTags('discovery')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('discovery')
export class DiscoveryController {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly channels: ChannelsService,
  ) {}

  @Get('channels')
  @ApiOperation({ summary: 'Kashf etilgan kanal nomzodlari (mention soni bilan)' })
  list(@Query('status') status?: string) {
    return this.discovery.list(status ?? 'PENDING');
  }

  @Post('channels/:id')
  @ApiOperation({ summary: 'Nomzodni tasdiqlash (kuzatuvga qo`shish) yoki rad etish' })
  async resolve(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ResolveDto) {
    if (dto.action === 'approve') {
      const { username } = await this.discovery.setStatus(id, 'APPROVED');
      const res = await this.channels.bulkImport([username]);
      return { approved: username, ...res };
    }
    await this.discovery.setStatus(id, 'REJECTED');
    return { rejected: true };
  }
}
