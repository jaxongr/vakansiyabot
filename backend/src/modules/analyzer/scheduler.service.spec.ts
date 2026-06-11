import { SchedulerService } from './scheduler.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('SchedulerService (EXPIRED)', () => {
  const prisma = {
    vacancy: { findMany: jest.fn(), updateMany: jest.fn() },
    resume: { findMany: jest.fn(), updateMany: jest.fn() },
  };
  const queue = { add: jest.fn() };

  beforeEach(() => jest.clearAllMocks());

  it('30 kundan eski vakansiya/rezyume -> EXPIRED + delete job', async () => {
    prisma.vacancy.findMany.mockResolvedValue([{ id: 'v1' }, { id: 'v2' }]);
    prisma.vacancy.updateMany.mockResolvedValue({ count: 2 });
    prisma.resume.findMany.mockResolvedValue([{ id: 'r1' }]);
    prisma.resume.updateMany.mockResolvedValue({ count: 1 });

    const svc = new SchedulerService(prisma as unknown as PrismaService, queue as never);
    await svc.expireOldEntries();

    expect(prisma.vacancy.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'EXPIRED' } }),
    );
    expect(queue.add).toHaveBeenCalledWith('publish', { vacancyId: 'v1', action: 'delete' });
    expect(queue.add).toHaveBeenCalledWith('publish', { resumeId: 'r1', action: 'delete' });
    expect(queue.add).toHaveBeenCalledTimes(3);
  });

  it('eski yozuv yo`q -> hech narsa qilmaydi', async () => {
    prisma.vacancy.findMany.mockResolvedValue([]);
    prisma.resume.findMany.mockResolvedValue([]);
    const svc = new SchedulerService(prisma as unknown as PrismaService, queue as never);
    await svc.expireOldEntries();
    expect(prisma.vacancy.updateMany).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });
});
