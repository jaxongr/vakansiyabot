import { ScraperScheduler } from './scraper.scheduler';
import { ScraperService } from './scraper.service';

describe('ScraperScheduler', () => {
  it('tick -> scrapeDue chaqiradi', async () => {
    const scraper = { scrapeDue: jest.fn().mockResolvedValue(undefined) };
    const sched = new ScraperScheduler(scraper as unknown as ScraperService);
    await sched.tick();
    expect(scraper.scrapeDue).toHaveBeenCalled();
  });

  it('oldingi sikl tugamagan bo`lsa o`tkazib yuboradi', async () => {
    let resolve!: () => void;
    const scraper = {
      scrapeDue: jest.fn(() => new Promise<void>((r) => (resolve = r))),
    };
    const sched = new ScraperScheduler(scraper as unknown as ScraperService);
    const first = sched.tick();
    await sched.tick(); // running=true, o'tkazib yuboriladi
    expect(scraper.scrapeDue).toHaveBeenCalledTimes(1);
    resolve();
    await first;
  });

  it('xato bo`lsa crash qilmaydi, running reset bo`ladi', async () => {
    const scraper = { scrapeDue: jest.fn().mockRejectedValue(new Error('boom')) };
    const sched = new ScraperScheduler(scraper as unknown as ScraperService);
    await expect(sched.tick()).resolves.toBeUndefined();
    await sched.tick();
    expect(scraper.scrapeDue).toHaveBeenCalledTimes(2);
  });
});
