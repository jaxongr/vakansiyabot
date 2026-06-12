import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { RulesService } from './rules.service';
import { LlmService } from './llm.service';
import { AnalyzerProcessor } from './analyzer.processor';
import { SchedulerService } from './scheduler.service';
import { DiscoveryService } from './discovery.service';
import { DiscoveryController } from './discovery.controller';
import { DedupModule } from '../dedup/dedup.module';
import { ChannelsModule } from '../channels/channels.module';
import {
  ANALYZE_QUEUE,
  DEAD_LETTER_QUEUE,
  DEDUP_QUEUE,
  DEFAULT_JOB_OPTIONS,
  PUBLISH_QUEUE,
} from '../../queues/queue.types';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: ANALYZE_QUEUE, defaultJobOptions: DEFAULT_JOB_OPTIONS },
      { name: DEDUP_QUEUE, defaultJobOptions: DEFAULT_JOB_OPTIONS },
      { name: PUBLISH_QUEUE, defaultJobOptions: DEFAULT_JOB_OPTIONS },
      { name: DEAD_LETTER_QUEUE },
    ),
    DedupModule,
    ChannelsModule,
  ],
  controllers: [DiscoveryController],
  providers: [RulesService, LlmService, AnalyzerProcessor, SchedulerService, DiscoveryService],
  exports: [RulesService, LlmService, DiscoveryService],
})
export class AnalyzerModule {}
