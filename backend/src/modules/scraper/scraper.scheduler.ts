import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ScraperService } from './scraper.service';

@Injectable()
export class ScraperScheduler {
  private readonly logger = new Logger(ScraperScheduler.name);
  private running = false;

  constructor(private readonly scraper: ScraperService) {}

  /** Har 10 daqiqada skanerlash vaqti kelgan manbalarni tekshiradi */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async tick(): Promise<void> {
    if (this.running) return; // oldingi sikl tugamagan bo'lsa o'tkazib yuboramiz
    this.running = true;
    try {
      await this.scraper.scrapeDue();
    } catch (error) {
      this.logger.error(`Scraper tick failed: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
