import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { StatsService } from './stats.service';

@ApiTags('stats')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Kunlik grafik, viloyat/kategoriya taqsimot, dublikat %' })
  overview() {
    return this.stats.overview();
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Mukammal analitika: funnel, manba, ish turi, maosh, soatlik' })
  analytics() {
    return this.stats.analytics();
  }

  @Get('channels')
  @ApiOperation({ summary: 'Top kanallar, dublikat ulushi' })
  channels() {
    return this.stats.channels();
  }
}
