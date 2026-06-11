import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { VacancyStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PUBLISH_QUEUE, PublishJobData } from '../../queues/queue.types';

const EXPIRE_AFTER_DAYS = 30;

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(PUBLISH_QUEUE) private readonly publishQueue: Queue<PublishJobData>,
  ) {}

  /** Har kuni 03:00 — 30 kundan eski ACTIVE -> EXPIRED, guruhdagi post o'chiriladi */
  @Cron('0 3 * * *')
  async expireOldEntries(): Promise<void> {
    const threshold = new Date(Date.now() - EXPIRE_AFTER_DAYS * 24 * 3600 * 1000);

    const vacancies = await this.prisma.vacancy.findMany({
      where: { status: VacancyStatus.ACTIVE, firstSeenAt: { lt: threshold }, deletedAt: null },
      select: { id: true },
    });
    if (vacancies.length > 0) {
      await this.prisma.vacancy.updateMany({
        where: { id: { in: vacancies.map((v) => v.id) } },
        data: { status: VacancyStatus.EXPIRED },
      });
      for (const vacancy of vacancies) {
        await this.publishQueue.add('publish', { vacancyId: vacancy.id, action: 'delete' });
      }
    }

    const resumes = await this.prisma.resume.findMany({
      where: { status: VacancyStatus.ACTIVE, firstSeenAt: { lt: threshold }, deletedAt: null },
      select: { id: true },
    });
    if (resumes.length > 0) {
      await this.prisma.resume.updateMany({
        where: { id: { in: resumes.map((r) => r.id) } },
        data: { status: VacancyStatus.EXPIRED },
      });
      for (const resume of resumes) {
        await this.publishQueue.add('publish', { resumeId: resume.id, action: 'delete' });
      }
    }

    this.logger.log(
      `Expired: ${vacancies.length} vacancies, ${resumes.length} resumes (>${EXPIRE_AFTER_DAYS} kun)`,
    );
  }
}
