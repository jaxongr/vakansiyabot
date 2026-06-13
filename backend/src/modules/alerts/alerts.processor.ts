import { Injectable } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AlertsService } from './alerts.service';
import { ALERT_QUEUE, AlertJobData } from '../../queues/queue.types';

/** Yangi vakansiya -> mos saqlangan qidiruvlar egalariga xabar */
@Injectable()
@Processor(ALERT_QUEUE)
export class AlertsProcessor extends WorkerHost {
  constructor(private readonly alerts: AlertsService) {
    super();
  }

  async process(job: Job<AlertJobData>): Promise<void> {
    await this.alerts.notifyMatching(job.data.vacancyId);
  }
}
