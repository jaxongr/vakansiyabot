import { CacheService } from './cache.service';

describe('CacheService', () => {
  let cache: CacheService;
  const redis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    scan: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    cache = new CacheService(redis as never);
  });

  it('get -> JSON parse', async () => {
    redis.get.mockResolvedValue('{"a":1}');
    expect(await cache.get('k')).toEqual({ a: 1 });
  });

  it('get bo`sh -> null', async () => {
    redis.get.mockResolvedValue(null);
    expect(await cache.get('k')).toBeNull();
  });

  it('set -> JSON stringify + EX', async () => {
    await cache.set('k', { a: 1 }, 120);
    expect(redis.set).toHaveBeenCalledWith('k', '{"a":1}', 'EX', 120);
  });

  it('del -> bir nechta kalit', async () => {
    await cache.del('a', 'b');
    expect(redis.del).toHaveBeenCalledWith('a', 'b');
  });

  it('del bo`sh -> redis chaqirilmaydi', async () => {
    await cache.del();
    expect(redis.del).not.toHaveBeenCalled();
  });

  it('delPattern -> SCAN sikli orqali o`chiradi', async () => {
    redis.scan
      .mockResolvedValueOnce(['10', ['k1', 'k2']])
      .mockResolvedValueOnce(['0', ['k3']]);
    await cache.delPattern('vacancies:list:*');
    expect(redis.scan).toHaveBeenCalledTimes(2);
    expect(redis.del).toHaveBeenCalledWith('k1', 'k2');
    expect(redis.del).toHaveBeenCalledWith('k3');
  });

  it('delPattern hech narsa topmasa del chaqirmaydi', async () => {
    redis.scan.mockResolvedValueOnce(['0', []]);
    await cache.delPattern('yoq:*');
    expect(redis.del).not.toHaveBeenCalled();
  });
});
