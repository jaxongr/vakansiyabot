import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { NormalizeService } from './normalize.service';

/**
 * 64-bitli simhash va o'xshashlik hisoblash.
 * Dedup qarori (CLAUDE.md):
 *   textHash teng        -> ayni post (collector bosqichida ushlanadi)
 *   phone + title teng   -> birlashtirish
 *   simhash sim > 0.92   -> birlashtirish
 *   0.85 - 0.92          -> DedupReview (admin)
 *   aks holda            -> yangi yozuv
 */
@Injectable()
export class MatcherService {
  constructor(private readonly normalize: NormalizeService) {}

  /** 64-bit simhash (hex, 16 belgi) */
  simhash(text: string): string {
    const tokens = this.normalize.tokens(text);
    const vector = new Array<number>(64).fill(0);

    for (const token of tokens) {
      const digest = createHash('md5').update(token).digest();
      // birinchi 8 baytdan 64-bit olamiz
      for (let bit = 0; bit < 64; bit += 1) {
        const byte = digest[Math.floor(bit / 8)];
        const isSet = (byte >> (7 - (bit % 8))) & 1;
        vector[bit] += isSet ? 1 : -1;
      }
    }

    let hash = 0n;
    for (let bit = 0; bit < 64; bit += 1) {
      if (vector[bit] > 0) hash |= 1n << BigInt(63 - bit);
    }
    return hash.toString(16).padStart(16, '0');
  }

  /** Hamming masofasiga asoslangan o'xshashlik: 1 - distance/64 */
  similarity(hashA: string, hashB: string): number {
    const a = BigInt(`0x${hashA}`);
    const b = BigInt(`0x${hashB}`);
    let xor = a ^ b;
    let distance = 0;
    while (xor > 0n) {
      distance += Number(xor & 1n);
      xor >>= 1n;
    }
    return 1 - distance / 64;
  }

  /** Telefon + sarlavha mosligi — kuchli signal */
  phoneTitleMatch(
    phonesA: string[],
    titleA: string,
    phonesB: string[],
    titleB: string,
  ): boolean {
    if (phonesA.length === 0 || phonesB.length === 0) return false;
    const setA = new Set(phonesA.map((p) => this.normalize.normalizePhone(p)));
    const shared = phonesB.some((p) => setA.has(this.normalize.normalizePhone(p)));
    if (!shared) return false;
    return this.normalize.normalizeTitle(titleA) === this.normalize.normalizeTitle(titleB);
  }
}
