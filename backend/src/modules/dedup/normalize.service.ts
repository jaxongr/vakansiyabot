import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

/**
 * Matnni tozalash va hash'lash — dedup pipeline'ning birinchi qadami.
 * Collector textHash uchun, matcher simhash uchun ishlatadi.
 */
@Injectable()
export class NormalizeService {
  /** Emoji, URL, imzo, ortiqcha bo'shliqlarni olib tashlaydi (taqqoslash uchun) */
  normalize(text: string): string {
    return (
      text
        .toLowerCase()
        // URL va t.me havolalar
        .replace(/https?:\/\/\S+/gi, ' ')
        .replace(/t\.me\/\S+/gi, ' ')
        // @username imzolar
        .replace(/@[a-z0-9_]{4,}/gi, ' ')
        // hashtag belgisi (so'z qoladi)
        .replace(/#/g, ' ')
        // emoji va piktogrammalar
        .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}]/gu, ' ')
        // variation selector (FE0F) va zero-width joiner (200D) — alohida
        .replace(/\u{FE0F}/gu, '')
        .replace(/\u{200D}/gu, '')
        // dekorativ belgilar
        .replace(/[▪►▶✔✅•◦‣⁃—–_*~`|]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    );
  }

  /** Agressiv normalizatsiya: faqat harf+raqam — textHash uchun */
  canonical(text: string): string {
    return this.normalize(text).replace(/[^\p{L}\p{N}]+/gu, '');
  }

  /** Normalized matn SHA-256 (hex) */
  hash(text: string): string {
    return createHash('sha256').update(this.canonical(text)).digest('hex');
  }

  /** Telefonni kanonik ko'rinishga keltiradi: 998901234567 */
  normalizePhone(phone: string): string {
    let digits = phone.replace(/\D/g, '');
    if (digits.length === 9) digits = `998${digits}`;
    if (digits.length === 12 && digits.startsWith('998')) return digits;
    return digits;
  }

  /** Sarlavhani taqqoslash uchun soddalashtiradi */
  normalizeTitle(title: string): string {
    return this.normalize(title).replace(/[^\p{L}\p{N} ]+/gu, '').trim();
  }

  /** Simhash uchun tokenlar */
  tokens(text: string): string[] {
    return this.normalize(text)
      .split(/[^\p{L}\p{N}]+/u)
      .filter((t) => t.length > 1);
  }
}
