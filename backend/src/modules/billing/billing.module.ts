import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PaymeController } from './webhooks/payme.controller';
import { ClickController } from './webhooks/click.controller';
import { DEFAULT_JOB_OPTIONS, PUBLISH_QUEUE } from '../../queues/queue.types';

@Module({
  imports: [
    BullModule.registerQueue({ name: PUBLISH_QUEUE, defaultJobOptions: DEFAULT_JOB_OPTIONS }),
  ],
  controllers: [BillingController, PaymeController, ClickController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
