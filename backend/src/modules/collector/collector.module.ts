import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CollectorService } from './collector.service';
import { ChannelsManager } from './channels.manager';
import { DedupModule } from '../dedup/dedup.module';
import { ANALYZE_QUEUE } from '../../queues/queue.types';

@Module({
  imports: [BullModule.registerQueue({ name: ANALYZE_QUEUE }), DedupModule],
  providers: [CollectorService, ChannelsManager],
  exports: [CollectorService, ChannelsManager],
})
export class CollectorModule {}
