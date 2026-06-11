import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DedupReviewStatus, VacancyStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/errors/app.exception';
import { buildCursorPage } from '../../common/pagination/cursor';
import { PUBLISH_QUEUE, PublishJobData } from '../../queues/queue.types';

const REVIEW_INCLUDE = {
  vacancyA: {
    select: { id: true, title: true, description: true, phones: true, createdAt: true },
  },
  vacancyB: {
    select: { id: true, title: true, description: true, phones: true, createdAt: true },
  },
};

@Injectable()
export class DedupReviewService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(PUBLISH_QUEUE) private readonly publishQueue: Queue<PublishJobData>,
  ) {}

  async list(cursor?: string, limit = 20) {
    const rows = await this.prisma.dedupReview.findMany({
      where: { status: DedupReviewStatus.PENDING },
      include: REVIEW_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    return buildCursorPage(rows, limit);
  }

  /**
   * merge: B manbalari A ga ko'chiriladi, B yashiriladi (guruh posti o'chadi)
   * separate: ikkalasi mustaqil — shunchaki belgilanadi
   */
  async resolve(id: string, action: 'merge' | 'separate') {
    const review = await this.prisma.dedupReview.findUnique({ where: { id } });
    if (!review) throw AppException.notFound('Review topilmadi');
    if (review.status !== DedupReviewStatus.PENDING) {
      throw AppException.conflict(
        'E1004' as never,
        'Bu juftlik allaqachon hal qilingan',
      );
    }

    if (action === 'merge') {
      await this.prisma.$transaction(async (tx) => {
        const sourcesB = await tx.vacancySource.findMany({
          where: { vacancyId: review.vacancyBId },
        });
        for (const source of sourcesB) {
          await tx.vacancySource
            .create({ data: { vacancyId: review.vacancyAId, rawPostId: source.rawPostId } })
            .catch(() => undefined); // allaqachon bor bo'lsa jim
        }
        await tx.vacancySource.deleteMany({ where: { vacancyId: review.vacancyBId } });
        await tx.vacancy.update({
          where: { id: review.vacancyBId },
          data: { status: VacancyStatus.HIDDEN, deletedAt: new Date() },
        });
        await tx.dedupReview.update({
          where: { id },
          data: { status: DedupReviewStatus.MERGED, resolvedAt: new Date() },
        });
      });
      await this.publishQueue.add('publish', { vacancyId: review.vacancyBId, action: 'delete' });
    } else {
      await this.prisma.dedupReview.update({
        where: { id },
        data: { status: DedupReviewStatus.SEPARATED, resolvedAt: new Date() },
      });
    }

    return { id, action };
  }
}
