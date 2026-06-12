import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { VacanciesController } from './vacancies.controller';
import { VacanciesService } from './vacancies.service';
import { ResumesController } from './resumes.controller';
import { ResumesService } from './resumes.service';
import { BillingModule } from '../billing/billing.module';
import { DEFAULT_JOB_OPTIONS, PUBLISH_QUEUE } from '../../queues/queue.types';

@Module({
  imports: [
    BullModule.registerQueue({ name: PUBLISH_QUEUE, defaultJobOptions: DEFAULT_JOB_OPTIONS }),
    BillingModule,
  ],
  controllers: [VacanciesController, ResumesController],
  providers: [VacanciesService, ResumesService],
  exports: [VacanciesService],
})
export class VacanciesModule {}
