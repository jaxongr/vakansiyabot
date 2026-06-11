import { Injectable } from '@nestjs/common';
import { ScrapedItem, ScraperAdapter } from './scraper-adapter.interface';
import { httpGet } from './http-client';

/**
 * Universal RSS/Atom adapter — ko'p vakansiya saytlari (shu jumladan hh.uz,
 * ish.uz eksport) RSS beradi. <item><title><description><link><pubDate>.
 * Regex-asoslangan yengil parser (qo'shimcha kutubxonasiz).
 */
@Injectable()
export class RssAdapter implements ScraperAdapter {
  readonly type = 'GENERIC_RSS';

  async fetch(url: string): Promise<ScrapedItem[]> {
    const xml = await httpGet(url, 'application/rss+xml, application/xml, text/xml');
    return this.parse(xml);
  }

  parse(xml: string): ScrapedItem[] {
    const items: ScrapedItem[] = [];
    const itemRe = /<(?:item|entry)\b[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi;

    for (const match of xml.matchAll(itemRe)) {
      const block = match[1];
      const title = this.tag(block, 'title');
      const description = this.stripHtml(this.tag(block, 'description') || this.tag(block, 'summary'));
      const link = this.tag(block, 'link') || this.attrLink(block);
      const pubDate = this.tag(block, 'pubDate') || this.tag(block, 'updated') || this.tag(block, 'published');
      const guid = this.tag(block, 'guid') || link;

      if (!title && !description) continue;
      const text = [title, description].filter(Boolean).join('\n');
      if (text.trim().length < 20) continue;

      items.push({
        externalId: (guid || link || title).slice(0, 250),
        externalUrl: link,
        text,
        postedAt: this.parseDate(pubDate),
      });
    }
    return items;
  }

  private tag(block: string, name: string): string {
    const re = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i');
    const m = block.match(re);
    if (!m) return '';
    return this.unescape(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')).trim();
  }

  /** Atom <link href="..."/> */
  private attrLink(block: string): string {
    const m = block.match(/<link\b[^>]*href=["']([^"']+)["']/i);
    return m ? m[1] : '';
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private unescape(s: string): string {
    return s
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');
  }

  private parseDate(raw: string): Date {
    if (!raw) return new Date();
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }
}
