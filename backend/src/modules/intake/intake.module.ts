import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { IntakeService } from './intake.service';
import { IntakeStateService } from './intake-state.service';
import { BrowseService } from './browse.service';
import { AnalyzerModule } from '../analyzer/analyzer.module';
import { BillingModule } from '../billing/billing.module';
import { DEFAULT_JOB_OPTIONS, PUBLISH_QUEUE } from '../../queues/queue.types';

@Module({
  imports: [
    BullModule.registerQueue({ name: PUBLISH_QUEUE, defaultJobOptions: DEFAULT_JOB_OPTIONS }),
    AnalyzerModule,
    BillingModule,
  ],
  providers: [IntakeService, IntakeStateService, BrowseService],
  exports: [IntakeService, BrowseService],
})
export class IntakeModule {}
