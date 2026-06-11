import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { DedupReviewService } from './dedup-review.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PUBLISH_QUEUE } from '../../queues/queue.types';
import { ErrorCode } from '../../common/errors/error-codes';

describe('DedupReviewService', () => {
  let service: DedupReviewService;

  const tx = {
    vacancySource: { findMany: jest.fn(), create: jest.fn(), deleteMany: jest.fn() },
    vacancy: { update: jest.fn() },
    dedupReview: { update: jest.fn() },
  };
  const prisma = {
    dedupReview: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(async (cb: (t: typeof tx) => Promise<void>) => cb(tx)),
  };
  const publishQueue = { add: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    tx.vacancySource.create.mockResolvedValue({});
    tx.vacancySource.deleteMany.mockResolvedValue({ count: 1 });
    tx.vacancy.update.mockResolvedValue({});
    tx.dedupReview.update.mockResolvedValue({});
    const moduleRef = await Test.createTestingModule({
      providers: [
        DedupReviewService,
        { provide: PrismaService, useValue: prisma },
        { provide: getQueueToken(PUBLISH_QUEUE), useValue: publishQueue },
      ],
    }).compile();
    service = moduleRef.get(DedupReviewService);
  });

  it('list -> PENDING juftliklar', async () => {
    prisma.dedupReview.findMany.mockResolvedValue([{ id: 'rev1' }]);
    const res = await service.list(undefined, 20);
    expect(prisma.dedupReview.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'PENDING' } }),
    );
    expect(res.data).toHaveLength(1);
  });

  it('merge -> B manbalari A ga, B yashiriladi, delete job', async () => {
    prisma.dedupReview.findUnique.mockResolvedValue({
      id: 'rev1',
      status: 'PENDING',
      vacancyAId: 'A',
      vacancyBId: 'B',
    });
    tx.vacancySource.findMany.mockResolvedValue([{ rawPostId: 'rp1' }]);

    await service.resolve('rev1', 'merge');

    expect(tx.vacancySource.create).toHaveBeenCalledWith({
      data: { vacancyId: 'A', rawPostId: 'rp1' },
    });
    expect(tx.vacancy.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'B' }, data: expect.objectContaining({ status: 'HIDDEN' }) }),
    );
    expect(publishQueue.add).toHaveBeenCalledWith('publish', { vacancyId: 'B', action: 'delete' });
  });

  it('separate -> faqat status SEPARATED', async () => {
    prisma.dedupReview.findUnique.mockResolvedValue({
      id: 'rev1',
      status: 'PENDING',
      vacancyAId: 'A',
      vacancyBId: 'B',
    });
    await service.resolve('rev1', 'separate');
    expect(prisma.dedupReview.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SEPARATED' }) }),
    );
    expect(publishQueue.add).not.toHaveBeenCalled();
  });

  it('topilmasa E1003', async () => {
    prisma.dedupReview.findUnique.mockResolvedValue(null);
    await expect(service.resolve('yoq', 'merge')).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND,
    });
  });

  it('allaqachon hal qilingan -> conflict', async () => {
    prisma.dedupReview.findUnique.mockResolvedValue({ id: 'rev1', status: 'MERGED' });
    await expect(service.resolve('rev1', 'merge')).rejects.toBeDefined();
  });
});
