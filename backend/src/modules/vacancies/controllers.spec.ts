import { VacanciesController } from './vacancies.controller';
import { ResumesController } from './resumes.controller';
import { VacanciesService } from './vacancies.service';
import { ResumesService } from './resumes.service';
import { JwtPayload } from '../../common/decorators/current-user.decorator';

describe('Vacancies/Resumes controllers (delegatsiya)', () => {
  const vacanciesService = {
    list: jest.fn().mockResolvedValue('list'),
    detail: jest.fn().mockResolvedValue('detail'),
    update: jest.fn().mockResolvedValue('updated'),
    savedList: jest.fn().mockResolvedValue('saved'),
    save: jest.fn().mockResolvedValue({ saved: true }),
    unsave: jest.fn().mockResolvedValue({ saved: false }),
  };
  const resumesService = {
    list: jest.fn().mockResolvedValue('rlist'),
    detail: jest.fn().mockResolvedValue('rdetail'),
  };
  const user: JwtPayload = { sub: 'u1', tgUserId: '1', role: 'USER' };

  const vc = new VacanciesController(vacanciesService as unknown as VacanciesService);
  const rc = new ResumesController(resumesService as unknown as ResumesService);

  it('vacancies list/detail/update delegatsiya', async () => {
    await vc.list({ limit: 20 });
    await vc.detail('v1');
    await vc.update('v1', { title: 'X' });
    expect(vacanciesService.list).toHaveBeenCalled();
    expect(vacanciesService.detail).toHaveBeenCalledWith('v1');
    expect(vacanciesService.update).toHaveBeenCalledWith('v1', { title: 'X' });
  });

  it('saved CRUD user.sub bilan', async () => {
    await vc.saved(user);
    await vc.save(user, 'v1');
    await vc.unsave(user, 'v1');
    expect(vacanciesService.savedList).toHaveBeenCalledWith('u1');
    expect(vacanciesService.save).toHaveBeenCalledWith('u1', 'v1');
    expect(vacanciesService.unsave).toHaveBeenCalledWith('u1', 'v1');
  });

  it('resumes list/detail delegatsiya', async () => {
    await rc.list({ limit: 20 });
    await rc.detail('r1');
    expect(resumesService.list).toHaveBeenCalled();
    expect(resumesService.detail).toHaveBeenCalledWith('r1');
  });
});

describe('ResumesService', () => {
  const prisma = {
    resume: { findMany: jest.fn(), findFirst: jest.fn() },
  };

  it('list -> cursor page', async () => {
    prisma.resume.findMany.mockResolvedValue([{ id: 'r1' }]);
    const svc = new ResumesService(prisma as never);
    const res = await svc.list({ limit: 20, regionId: 'reg1' });
    expect(res.data).toHaveLength(1);
    expect(prisma.resume.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ regionId: 'reg1' }) }),
    );
  });

  it('detail topilmasa E1003', async () => {
    prisma.resume.findFirst.mockResolvedValue(null);
    const svc = new ResumesService(prisma as never);
    await expect(svc.detail('yoq')).rejects.toMatchObject({ code: 'E1003' });
  });
});
