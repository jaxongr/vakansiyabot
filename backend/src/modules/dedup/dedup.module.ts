import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NormalizeService } from './normalize.service';
import { MatcherService } from './matcher.service';
import { DedupProcessor } from './dedup.processor';
import {
  DEAD_LETTER_QUEUE,
  DEDUP_QUEUE,
  DEFAULT_JOB_OPTIONS,
  PUBLISH_QUEUE,
} from '../../queues/queue.types';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: DEDUP_QUEUE, defaultJobOptions: DEFAULT_JOB_OPTIONS },
      { name: PUBLISH_QUEUE, defaultJobOptions: DEFAULT_JOB_OPTIONS },
      { name: DEAD_LETTER_QUEUE },
    ),
  ],
  providers: [NormalizeService, MatcherService, DedupProcessor],
  exports: [NormalizeService, MatcherService],
})
export class DedupModule {}
