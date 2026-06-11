import { ChannelsController } from './channels/channels.controller';
import { ChannelsService } from './channels/channels.service';
import { StatsController } from './stats/stats.controller';
import { StatsService } from './stats/stats.service';
import { DedupReviewController } from './dedup/dedup-review.controller';
import { DedupReviewService } from './dedup/dedup-review.service';
import { WebSourcesController } from './scraper/web-sources.controller';
import { WebSourcesService } from './scraper/web-sources.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { UsersController } from './users/users.controller';
import { RefsController } from './refs/refs.controller';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../redis/cache.service';
import { JwtPayload } from '../common/decorators/current-user.decorator';
import { ChannelStatus, WebSourceStatus } from '@prisma/client';

describe('Admin controllerlar delegatsiyasi', () => {
  it('ChannelsController -> service', async () => {
    const svc = {
      create: jest.fn().mockResolvedValue('c'),
      list: jest.fn().mockResolvedValue('l'),
      update: jest.fn().mockResolvedValue('u'),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const c = new ChannelsController(svc as unknown as ChannelsService);
    await c.create({ username: 'x' });
    await c.list({ limit: 20 });
    await c.update('id', { status: ChannelStatus.PAUSED });
    await c.remove('id');
    expect(svc.create).toHaveBeenCalledWith('x');
    expect(svc.update).toHaveBeenCalledWith('id', ChannelStatus.PAUSED);
    expect(svc.remove).toHaveBeenCalledWith('id');
  });

  it('StatsController -> service', async () => {
    const svc = { overview: jest.fn().mockResolvedValue('o'), channels: jest.fn().mockResolvedValue('c') };
    const c = new StatsController(svc as unknown as StatsService);
    await c.overview();
    await c.channels();
    expect(svc.overview).toHaveBeenCalled();
    expect(svc.channels).toHaveBeenCalled();
  });

  it('DedupReviewController -> service', async () => {
    const svc = { list: jest.fn().mockResolvedValue('l'), resolve: jest.fn().mockResolvedValue('r') };
    const c = new DedupReviewController(svc as unknown as DedupReviewService);
    await c.list({ limit: 20 });
    await c.resolve('id', { action: 'merge' });
    expect(svc.resolve).toHaveBeenCalledWith('id', 'merge');
  });

  it('WebSourcesController -> service', async () => {
    const svc = {
      create: jest.fn().mockResolvedValue('c'),
      list: jest.fn().mockResolvedValue('l'),
      setStatus: jest.fn().mockResolvedValue('s'),
      triggerNow: jest.fn().mockResolvedValue({ created: 1 }),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const c = new WebSourcesController(svc as unknown as WebSourcesService);
    await c.create({ type: 'GENERIC_RSS' as never, name: 'n', url: 'http://x', intervalMin: 30 });
    await c.list({ limit: 20 });
    await c.setStatus('id', { status: WebSourceStatus.PAUSED });
    await c.scrapeNow('id');
    await c.remove('id');
    expect(svc.setStatus).toHaveBeenCalledWith('id', WebSourceStatus.PAUSED);
    expect(svc.triggerNow).toHaveBeenCalledWith('id');
  });

  it('AuthController -> service', async () => {
    const svc = {
      loginWithInitData: jest.fn().mockResolvedValue('a'),
      loginWithTelegramWidget: jest.fn().mockResolvedValue('b'),
      refresh: jest.fn().mockResolvedValue('c'),
    };
    const c = new AuthController(svc as unknown as AuthService);
    await c.loginMiniApp({ initData: 'x' });
    await c.loginTelegram({ id: 1, auth_date: 1, hash: 'h' });
    await c.refresh({ refreshToken: 'r' });
    expect(svc.loginWithInitData).toHaveBeenCalledWith('x');
    expect(svc.refresh).toHaveBeenCalledWith('r');
  });

  it('UsersController me/update', async () => {
    const prisma = {
      appUser: {
        findUnique: jest.fn().mockResolvedValue({ id: 'u1', tgUserId: 5n, region: null }),
        update: jest.fn().mockResolvedValue({ id: 'u1', regionId: 'r1' }),
      },
    };
    const c = new UsersController(prisma as unknown as PrismaService);
    const user: JwtPayload = { sub: 'u1', tgUserId: '5', role: 'USER' };
    const me = await c.me(user);
    expect(me.tgUserId).toBe('5');
    await c.update(user, { regionId: 'r1' });
    expect(prisma.appUser.update).toHaveBeenCalled();
  });

  it('UsersController me topilmasa E1003', async () => {
    const prisma = { appUser: { findUnique: jest.fn().mockResolvedValue(null) } };
    const c = new UsersController(prisma as unknown as PrismaService);
    await expect(c.me({ sub: 'x', tgUserId: '1', role: 'USER' })).rejects.toMatchObject({
      code: 'E1003',
    });
  });

  it('RefsController regions/categories (cache miss -> DB)', async () => {
    const prisma = {
      region: { findMany: jest.fn().mockResolvedValue([{ id: 'r1' }]) },
      category: { findMany: jest.fn().mockResolvedValue([{ id: 'c1' }]) },
    };
    const cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn() };
    const c = new RefsController(
      prisma as unknown as PrismaService,
      cache as unknown as CacheService,
    );
    await c.regions();
    await c.categories();
    expect(cache.set).toHaveBeenCalledWith('regions:all', expect.anything(), expect.any(Number));
    expect(cache.set).toHaveBeenCalledWith('categories:all', expect.anything(), expect.any(Number));
  });

  it('RefsController cache hit -> DB ga bormaydi', async () => {
    const prisma = { region: { findMany: jest.fn() }, category: { findMany: jest.fn() } };
    const cache = { get: jest.fn().mockResolvedValue([{ id: 'cached' }]), set: jest.fn() };
    const c = new RefsController(
      prisma as unknown as PrismaService,
      cache as unknown as CacheService,
    );
    await c.regions();
    expect(prisma.region.findMany).not.toHaveBeenCalled();
  });
});
