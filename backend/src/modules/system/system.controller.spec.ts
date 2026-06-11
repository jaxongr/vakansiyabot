import { SystemController } from './system.controller';
import { SystemStatusService } from './system-status.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('SystemController', () => {
  let controller: SystemController;
  const prisma = { $queryRaw: jest.fn() };
  const redis = { ping: jest.fn() };
  let status: SystemStatusService;

  beforeEach(() => {
    jest.clearAllMocks();
    status = new SystemStatusService();
    controller = new SystemController(
      prisma as unknown as PrismaService,
      redis as never,
      status,
    );
  });

  it('hammasi sog`lom -> status ok', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    redis.ping.mockResolvedValue('PONG');
    status.set('collector', 'OK');

    const res = await controller.health();

    expect(res.status).toBe('ok');
    expect(res.db.status).toBe('OK');
    expect(res.redis.status).toBe('OK');
  });

  it('db yiqilsa -> degraded', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));
    redis.ping.mockResolvedValue('PONG');

    const res = await controller.health();

    expect(res.db.status).toBe('DOWN');
    expect(res.status).toBe('degraded');
  });

  it('komponent DOWN bo`lsa -> degraded', async () => {
    prisma.$queryRaw.mockResolvedValue([{}]);
    redis.ping.mockResolvedValue('PONG');
    status.set('publisher', 'DOWN', 'bot yiqildi');

    const res = await controller.health();

    expect(res.status).toBe('degraded');
    expect(res.components.publisher.status).toBe('DOWN');
  });
});

describe('SystemStatusService', () => {
  it('komponent holatini yozadi va o`qiydi', () => {
    const s = new SystemStatusService();
    s.set('x', 'OK', 'yaxshi');
    expect(s.get('x')).toMatchObject({ status: 'OK', message: 'yaxshi' });
    expect(s.all().x.status).toBe('OK');
  });
});
