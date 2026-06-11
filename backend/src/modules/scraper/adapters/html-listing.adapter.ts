import { Injectable } from '@nestjs/common';
import { ScrapedItem, ScraperAdapter } from './scraper-adapter.interface';
import { httpGet } from './http-client';

/**
 * ish.uz / OLX / hh.uz kabi saytlar uchun yengil HTML-listing adapter.
 * JSON-LD (schema.org JobPosting) bo'lsa undan, bo'lmasa <a href> + matn
 * bloklaridan e'lonlarni ajratadi. Maxsus DOM kutubxonasi shart emas.
 *
 * Eslatma: har sayt HTML'i o'zgaruvchan — bu "best-effort" extraktor.
 * Aniqroq natija uchun sayt RSS bersa GENERIC_RSS afzal.
 */
@Injectable()
export class HtmlListingAdapter implements ScraperAdapter {
  readonly type = 'HTML_LISTING';

  async fetch(url: string): Promise<ScrapedItem[]> {
    const html = await httpGet(url);
    const base = new URL(url);
    const jsonLd = this.parseJsonLd(html, base);
    if (jsonLd.length > 0) return jsonLd;
    return this.parseAnchors(html, base);
  }

  /** schema.org JobPosting (eng ishonchli) */
  private parseJsonLd(html: string, base: URL): ScrapedItem[] {
    const items: ScrapedItem[] = [];
    const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    for (const match of html.matchAll(re)) {
      try {
        const parsed = JSON.parse(match[1].trim());
        const nodes = Array.isArray(parsed) ? parsed : [parsed];
        for (const node of nodes) {
          const graph = node['@graph'] ? node['@graph'] : [node];
          for (const entry of graph) {
            if (entry['@type'] !== 'JobPosting') continue;
            const title = String(entry.title ?? '');
            const description = this.stripHtml(String(entry.description ?? ''));
            const text = [title, description].filter(Boolean).join('\n');
            if (text.trim().length < 20) continue;
            const link = String(entry.url ?? base.href);
            items.push({
              externalId: link.slice(0, 250),
              externalUrl: link,
              text,
              postedAt: entry.datePosted ? new Date(entry.datePosted) : new Date(),
            });
          }
        }
      } catch {
        // yaroqsiz JSON-LD — keyingisiga o'tamiz
      }
    }
    return items;
  }

  /** Fallback: e'lon kartalari havolalari + atrofidagi matn */
  private parseAnchors(html: string, base: URL): ScrapedItem[] {
    const items: ScrapedItem[] = [];
    const seen = new Set<string>();
    const anchorRe = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

    for (const match of html.matchAll(anchorRe)) {
      const href = match[1];
      const label = this.stripHtml(match[2]);
      // vakansiyaga o'xshash havolalar: /job, /vacancy, /ish, /ads
      if (!/job|vacanc| vakans|\/ish|\/ads|\/obyavlenie|item/i.test(href)) continue;
      if (label.length < 10) continue;

      const abs = this.absolute(href, base);
      if (seen.has(abs)) continue;
      seen.add(abs);

      items.push({
        externalId: abs.slice(0, 250),
        externalUrl: abs,
        text: label,
        postedAt: new Date(),
      });
      if (items.length >= 50) break;
    }
    return items;
  }

  private absolute(href: string, base: URL): string {
    try {
      return new URL(href, base).href;
    } catch {
      return href;
    }
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z#0-9]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
