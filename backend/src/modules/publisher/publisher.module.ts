import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BotService } from './bot.service';
import { TopicsService } from './topics.service';
import { PublishProcessor } from './publish.processor';
import { IntakeModule } from '../intake/intake.module';
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
    IntakeModule,
  ],
  providers: [BotService, TopicsService, PublishProcessor],
  exports: [BotService, TopicsService],
})
export class PublisherModule {}
