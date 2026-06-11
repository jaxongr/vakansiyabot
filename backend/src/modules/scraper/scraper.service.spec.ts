import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { WebSourceStatus, WebSourceType } from '@prisma/client';
import { ScraperService } from './scraper.service';
import { RssAdapter } from './adapters/rss.adapter';
import { HtmlListingAdapter } from './adapters/html-listing.adapter';
import { NormalizeService } from '../dedup/normalize.service';
import { SystemStatusService } from '../system/system-status.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ANALYZE_QUEUE } from '../../queues/queue.types';

describe('ScraperService', () => {
  let service: ScraperService;

  const prisma = {
    webSource: { findMany: jest.fn(), update: jest.fn() },
    rawPost: { create: jest.fn() },
  };
  const analyzeQueue = { add: jest.fn() };
  const rssAdapter = { type: 'GENERIC_RSS', fetch: jest.fn() };
  const htmlAdapter = { type: 'HTML_LISTING', fetch: jest.fn() };

  const source = {
    id: 'ws-1',
    type: WebSourceType.GENERIC_RSS,
    name: 'Test RSS',
    url: 'https://example.com/rss',
    status: WebSourceStatus.ACTIVE,
    intervalMin: 30,
    lastScrapedAt: null,
    lastError: null,
    postsCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ScraperService,
        NormalizeService,
        SystemStatusService,
        { provide: RssAdapter, useValue: rssAdapter },
        { provide: HtmlListingAdapter, useValue: htmlAdapter },
        { provide: PrismaService, useValue: prisma },
        { provide: getQueueToken(ANALYZE_QUEUE), useValue: analyzeQueue },
      ],
    }).compile();
    service = moduleRef.get(ScraperService);
  });

  it('yangi e`lonlarni RawPost(origin=WEB) qilib analyze queue ga qo`yadi', async () => {
    rssAdapter.fetch.mockResolvedValue([
      { externalId: 'job-1', externalUrl: 'https://e.com/1', text: 'Dasturchi kerak Toshkent', postedAt: new Date() },
      { externalId: 'job-2', externalUrl: 'https://e.com/2', text: 'Sotuvchi kerak Samarqand', postedAt: new Date() },
    ]);
    prisma.rawPost.create.mockResolvedValueOnce({ id: 'r1' }).mockResolvedValueOnce({ id: 'r2' });

    const created = await service.scrapeOne(source);

    expect(created).toBe(2);
    expect(prisma.rawPost.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ origin: 'WEB', webSourceId: 'ws-1', externalId: 'job-1' }),
      }),
    );
    expect(analyzeQueue.add).toHaveBeenCalledTimes(2);
  });

  it('takror e`lon (P2002) jim o`tkaziladi', async () => {
    rssAdapter.fetch.mockResolvedValue([
      { externalId: 'dup', externalUrl: 'u', text: 'Takror e`lon matni uzunroq', postedAt: new Date() },
    ]);
    prisma.rawPost.create.mockRejectedValue({ code: 'P2002' });

    const created = await service.scrapeOne(source);

    expect(created).toBe(0);
    expect(analyzeQueue.add).not.toHaveBeenCalled();
    expect(prisma.webSource.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lastError: null }) }),
    );
  });

  it('fetch xatosi manbani ERROR holatiga o`tkazadi, crash QILMAYDI', async () => {
    rssAdapter.fetch.mockRejectedValue(new Error('HTTP 503'));

    const created = await service.scrapeOne(source);

    expect(created).toBe(0);
    expect(prisma.webSource.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: WebSourceStatus.ERROR, lastError: 'HTTP 503' }),
      }),
    );
  });

  it('scrapeDue faqat vaqti kelganlarni tanlaydi', async () => {
    const fresh = { ...source, id: 'fresh', lastScrapedAt: new Date() }; // hozir skanerlangan
    const stale = { ...source, id: 'stale', lastScrapedAt: new Date(Date.now() - 60 * 60_000) };
    prisma.webSource.findMany.mockResolvedValue([fresh, stale]);
    rssAdapter.fetch.mockResolvedValue([]);

    await service.scrapeDue();

    // faqat stale uchun fetch chaqirilishi kerak
    expect(rssAdapter.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('RssAdapter.parse', () => {
  const adapter = new RssAdapter();

  it('RSS item larni ajratadi', () => {
    const xml = `<?xml version="1.0"?><rss><channel>
      <item>
        <title>Dasturchi kerak</title>
        <description><![CDATA[Toshkent shahriga React dasturchi kerak. Maosh 10 mln]]></description>
        <link>https://ish.uz/job/123</link>
        <guid>123</guid>
        <pubDate>Mon, 10 Jun 2026 10:00:00 +0500</pubDate>
      </item>
      <item>
        <title>Sotuvchi</title>
        <description>Magazinga sotuvchi kerak Samarqand</description>
        <link>https://ish.uz/job/124</link>
      </item>
    </channel></rss>`;

    const items = adapter.parse(xml);

    expect(items).toHaveLength(2);
    expect(items[0].externalId).toBe('123');
    expect(items[0].externalUrl).toBe('https://ish.uz/job/123');
    expect(items[0].text).toContain('Dasturchi kerak');
    expect(items[0].text).toContain('React dasturchi');
  });

  it('juda qisqa itemlarni tashlaydi', () => {
    const xml = `<rss><item><title>Ish</title><description>Bor</description></item></rss>`;
    expect(adapter.parse(xml)).toHaveLength(0);
  });

  it('Atom feed (entry/link href) ni ham o`qiydi', () => {
    const xml = `<feed><entry>
      <title>Quruvchi kerak</title>
      <summary>Qarshi shahriga tajribali quruvchilar kerak, yaxshi sharoit</summary>
      <link href="https://hh.uz/vacancy/55"/>
      <published>2026-06-10T10:00:00Z</published>
    </entry></feed>`;
    const items = adapter.parse(xml);
    expect(items).toHaveLength(1);
    expect(items[0].externalUrl).toBe('https://hh.uz/vacancy/55');
  });
});

describe('HtmlListingAdapter JSON-LD', () => {
  const adapter = new HtmlListingAdapter();

  it('schema.org JobPosting ni ajratadi', async () => {
    const html = `<html><head>
      <script type="application/ld+json">
      {"@type":"JobPosting","title":"Backend dasturchi","description":"<p>Node.js bilan ishlash, Toshkent</p>","url":"https://ish.uz/job/9","datePosted":"2026-06-10"}
      </script></head><body></body></html>`;

    const items = await (
      adapter as unknown as { parseJsonLd: (h: string, b: URL) => unknown[] }
    ).parseJsonLd(html, new URL('https://ish.uz'));

    expect(items).toHaveLength(1);
    expect((items[0] as { text: string }).text).toContain('Backend dasturchi');
    expect((items[0] as { text: string }).text).toContain('Node.js');
  });
});
