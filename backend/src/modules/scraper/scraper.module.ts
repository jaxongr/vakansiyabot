import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ScraperService } from './scraper.service';
import { ScraperScheduler } from './scraper.scheduler';
import { WebSourcesController } from './web-sources.controller';
import { WebSourcesService } from './web-sources.service';
import { RssAdapter } from './adapters/rss.adapter';
import { HtmlListingAdapter } from './adapters/html-listing.adapter';
import { DedupModule } from '../dedup/dedup.module';
import { ANALYZE_QUEUE, DEFAULT_JOB_OPTIONS } from '../../queues/queue.types';

@Module({
  imports: [
    BullModule.registerQueue({ name: ANALYZE_QUEUE, defaultJobOptions: DEFAULT_JOB_OPTIONS }),
    DedupModule,
  ],
  controllers: [WebSourcesController],
  providers: [ScraperService, ScraperScheduler, WebSourcesService, RssAdapter, HtmlListingAdapter],
  exports: [ScraperService],
})
export class ScraperModule {}
