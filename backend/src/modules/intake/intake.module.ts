import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { IntakeService } from './intake.service';
import { IntakeStateService } from './intake-state.service';
import { AnalyzerModule } from '../analyzer/analyzer.module';
import { DEFAULT_JOB_OPTIONS, PUBLISH_QUEUE } from '../../queues/queue.types';

@Module({
  imports: [
    BullModule.registerQueue({ name: PUBLISH_QUEUE, defaultJobOptions: DEFAULT_JOB_OPTIONS }),
    AnalyzerModule,
  ],
  providers: [IntakeService, IntakeStateService],
  exports: [IntakeService],
})
export class IntakeModule {}
