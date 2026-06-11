import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { Public } from '../../common/decorators/public.decorator';
import { SystemStatusService } from './system-status.service';

@ApiTags('system')
@Public()
@Controller('system')
export class SystemController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly status: SystemStatusService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'System health: db, redis, collector, bot, queues' })
  async health() {
    const [db, redis] = await Promise.all([this.checkDb(), this.checkRedis()]);
    const components = this.status.all();
    const ok =
      db.status === 'OK' &&
      redis.status === 'OK' &&
      Object.values(components).every((c) => c.status !== 'DOWN');

    return {
      status: ok ? 'ok' : 'degraded',
      db,
      redis,
      components,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDb() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'OK' as const };
    } catch (e) {
      return { status: 'DOWN' as const, message: (e as Error).message };
    }
  }

  private async checkRedis() {
    try {
      const pong = await this.redis.ping();
      return { status: pong === 'PONG' ? ('OK' as const) : ('DEGRADED' as const) };
    } catch (e) {
      return { status: 'DOWN' as const, message: (e as Error).message };
    }
  }
}
