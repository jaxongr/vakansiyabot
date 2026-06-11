import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Origin, WebSource, WebSourceStatus, WebSourceType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NormalizeService } from '../dedup/normalize.service';
import { SystemStatusService } from '../system/system-status.service';
import { RssAdapter } from './adapters/rss.adapter';
import { HtmlListingAdapter } from './adapters/html-listing.adapter';
import { ScraperAdapter } from './adapters/scraper-adapter.interface';
import { ANALYZE_QUEUE, AnalyzeJobData } from '../../queues/queue.types';

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly normalize: NormalizeService,
    private readonly status: SystemStatusService,
    private readonly rss: RssAdapter,
    private readonly html: HtmlListingAdapter,
    @InjectQueue(ANALYZE_QUEUE) private readonly analyzeQueue: Queue<AnalyzeJobData>,
  ) {}

  private adapterFor(type: WebSourceType): ScraperAdapter {
    return type === WebSourceType.GENERIC_RSS ? this.rss : this.html;
  }

  /** Skanerlash vaqti kelgan barcha ACTIVE manbalarni qayta ishlaydi */
  async scrapeDue(): Promise<void> {
    const sources = await this.prisma.webSource.findMany({
      where: { status: WebSourceStatus.ACTIVE, deletedAt: null },
    });
    const now = Date.now();
    const due = sources.filter(
      (s) =>
        !s.lastScrapedAt ||
        now - s.lastScrapedAt.getTime() >= s.intervalMin * 60_000,
    );

    let totalNew = 0;
    for (const source of due) {
      totalNew += await this.scrapeOne(source);
    }
    this.status.set(
      'scraper',
      'OK',
      `${sources.length} manba, oxirgi siklda ${totalNew} yangi e'lon`,
    );
  }

  /** Bitta manbani skanerlaydi, yangi RawPost'larni analyze queue'ga qo'yadi */
  async scrapeOne(source: WebSource): Promise<number> {
    try {
      const items = await this.adapterFor(source.type).fetch(source.url);
      let created = 0;

      for (const item of items) {
        try {
          const rawPost = await this.prisma.rawPost.create({
            data: {
              origin: Origin.WEB,
              webSourceId: source.id,
              externalId: item.externalId,
              externalUrl: item.externalUrl,
              text: item.text,
              textHash: this.normalize.hash(item.text),
              postedAt: item.postedAt,
            },
            select: { id: true },
          });
          await this.analyzeQueue.add('analyze', { rawPostId: rawPost.id });
          created += 1;
        } catch (error) {
          // @@unique([webSourceId, externalId]) — takror e'lon jim o'tkaziladi
          if ((error as { code?: string }).code !== 'P2002') throw error;
        }
      }

      await this.prisma.webSource.update({
        where: { id: source.id },
        data: {
          lastScrapedAt: new Date(),
          lastError: null,
          status: WebSourceStatus.ACTIVE,
          postsCount: { increment: created },
        },
      });
      this.logger.log(`Scraped "${source.name}": ${items.length} item, ${created} yangi`);
      return created;
    } catch (error) {
      const message = (error as Error).message;
      this.logger.error(`Scrape failed "${source.name}": ${message}`);
      await this.prisma.webSource.update({
        where: { id: source.id },
        data: { lastError: message, lastScrapedAt: new Date(), status: WebSourceStatus.ERROR },
      });
      return 0;
    }
  }
}
