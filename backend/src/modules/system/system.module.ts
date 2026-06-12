import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SystemController } from './system.controller';
import { SystemStatusService } from './system-status.service';
import {
  ANALYZE_QUEUE,
  DEAD_LETTER_QUEUE,
  DEDUP_QUEUE,
  PUBLISH_QUEUE,
} from '../../queues/queue.types';

@Global()
@Module({
  imports: [
    BullModule.registerQueue(
      { name: ANALYZE_QUEUE },
      { name: DEDUP_QUEUE },
      { name: PUBLISH_QUEUE },
      { name: DEAD_LETTER_QUEUE },
    ),
  ],
  controllers: [SystemController],
  providers: [SystemStatusService],
  exports: [SystemStatusService],
})
export class SystemModule {}
