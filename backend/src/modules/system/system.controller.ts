import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../../redis/redis.constants';
import { Public } from '../../common/decorators/public.decorator';
import { SystemStatusService } from './system-status.service';
import { ANALYZE_QUEUE, DEAD_LETTER_QUEUE, DEDUP_QUEUE, PUBLISH_QUEUE } from '../../queues/queue.types';

@ApiTags('system')
@Public()
@Controller('system')
export class SystemController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly status: SystemStatusService,
    @InjectQueue(ANALYZE_QUEUE) private readonly analyzeQueue: Queue,
    @InjectQueue(DEDUP_QUEUE) private readonly dedupQueue: Queue,
    @InjectQueue(PUBLISH_QUEUE) private readonly publishQueue: Queue,
    @InjectQueue(DEAD_LETTER_QUEUE) private readonly dlq: Queue,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'System health: db, redis, collector, bot, queues' })
  async health() {
    const [db, redis, queues] = await Promise.all([
      this.checkDb(),
      this.checkRedis(),
      this.checkQueues(),
    ]);
    const components = this.status.all();
    const ok =
      db.status === 'OK' &&
      redis.status === 'OK' &&
      Object.values(components).every((c) => c.status !== 'DOWN');

    return {
      status: ok ? 'ok' : 'degraded',
      db,
      redis,
      queues,
      components,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkQueues() {
    try {
      const [analyze, dedup, publish, dead] = await Promise.all([
        this.analyzeQueue.getJobCounts('waiting', 'active', 'failed'),
        this.dedupQueue.getJobCounts('waiting', 'active', 'failed'),
        this.publishQueue.getJobCounts('waiting', 'active', 'failed'),
        this.dlq.getJobCounts('waiting'),
      ]);
      return { analyze, dedup, publish, deadLetter: dead.waiting ?? 0 };
    } catch (e) {
      return { error: (e as Error).message };
    }
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
