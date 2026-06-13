import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { AlertsProcessor } from './alerts.processor';
import { PublisherModule } from '../publisher/publisher.module';
import { ALERT_QUEUE, DEFAULT_JOB_OPTIONS } from '../../queues/queue.types';

@Module({
  imports: [
    BullModule.registerQueue({ name: ALERT_QUEUE, defaultJobOptions: DEFAULT_JOB_OPTIONS }),
    PublisherModule,
  ],
  controllers: [AlertsController],
  providers: [AlertsService, AlertsProcessor],
  exports: [AlertsService],
})
export class AlertsModule {}
