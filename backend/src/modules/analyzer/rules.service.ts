import { Injectable } from '@nestjs/common';
import { NormalizeService } from '../dedup/normalize.service';
import { CITY_TO_REGION, REGION_CODES, REMOTE_KEYWORDS } from './dictionaries/cities';
import { CATEGORIES } from './dictionaries/categories';
import { ExtractedVacancy } from '../../queues/queue.types';

export interface RulesResult {
  extracted: ExtractedVacancy;
  /** rules ishonchsiz bo'lgan maydonlar — LLM fallback kerakligini bildiradi */
  needsLlm: boolean;
}

/** O'zbekiston operator prefikslari (telefon false-positive himoyasi) */
const OPERATOR_PREFIXES = new Set([
  '20', '33', '50', '55', '60', '61', '62', '65', '66', '67', '69',
  '70', '71', '72', '73', '74', '75', '76', '77', '78', '79',
  '88', '90', '91', '93', '94', '95', '97', '98', '99',
]);

const RESUME_PATTERNS: RegExp[] = [
  /\bish\s+(izlayapman|izlayman|qidiryapman|qidirayapman|kerak)\b/i,
  /\bиш\s+(излаяпман|излайман|қидиряпман|керак)\b/i,
  /ишга\s+жойлашмоқчиман|ishga\s+joylashmoqchiman/i,
  /ищу\s+работу|ищу\s+подработку/i,
  /\brezyume\b|\bрезюме\b|#rezyume|#резюме/i,
  /\bish\s+izlovchi\b|иш\s+изловчи/i,
  /o'zim\s+haqimda|ўзим\s+ҳақимда|о\s+себе/i,
];

const AD_PATTERNS: RegExp[] = [
  /chegirma|skidka|скидка|aksiya|акция/i,
  /\breklama\b|\bреклама\b/i,
  /obuna\s+bo'?l|подпишись|подписывайтесь|kanalimizga\s+obuna/i,
  /konkurs|конкурс|lotereya|лотерея|sovg'a\s+o'yini/i,
];

// Eslatma: \b kirill harflar bilan ishlamaydi — (?![а-яё...]) lookahead ishlatamiz
const VACANCY_PATTERNS: RegExp[] = [
  /kerak(?![a-z])|керак(?![а-яёқўғҳ])/i,
  /talab\s+(qilinadi|etiladi)|талаб\s+(қилинади|этилади)/i,
  /требуется|требуются|приглашаем\s+на\s+работу/i,
  /vakansiya|вакансия|#vakansiya|#вакансия/i,
  /ishga\s+(olamiz|taklif|chaqiramiz)|ишга\s+(оламиз|таклиф)/i,
  /xodim|hodim|ходим(?![а-я])|сотрудник/i,
  /ish\s+haqi|иш\s+ҳақи|maosh|маош|oylik|ойлик|зарплата|оклад|з\/п/i,
];

@Injectable()
export class RulesService {
  constructor(private readonly normalize: NormalizeService) {}

  analyze(text: string): RulesResult {
    const lower = text.toLowerCase();

    const kind = this.detectKind(lower);
    const phones = this.extractPhones(text);
    const tgContact = this.extractTgContact(text);
    const salary = this.extractSalary(lower);
    const regionInfo = this.detectRegion(lower);
    const categoryCode = this.detectCategory(lower);
    const employmentType = this.detectEmploymentType(lower, regionInfo.isRemote);
    const title = this.extractTitle(text);

    const extracted: ExtractedVacancy = {
      kind,
      title,
      description: text.trim(),
      regionCode: regionInfo.code,
      categoryCode: categoryCode ?? 'boshqa',
      salaryMin: salary.min,
      salaryMax: salary.max,
      currency: salary.currency,
      employmentType,
      phones,
      tgContact,
      resume: kind === 'RESUME' ? this.extractResumeFields(text) : undefined,
    };

    const needsLlm =
      kind === 'OTHER' ||
      regionInfo.code === REGION_CODES.OTHER ||
      !categoryCode ||
      (phones.length === 0 && !tgContact);

    return { extracted, needsLlm };
  }

  detectKind(lower: string): ExtractedVacancy['kind'] {
    if (RESUME_PATTERNS.some((p) => p.test(lower))) return 'RESUME';
    if (AD_PATTERNS.some((p) => p.test(lower)) && !VACANCY_PATTERNS.some((p) => p.test(lower))) {
      return 'OTHER';
    }
    if (VACANCY_PATTERNS.some((p) => p.test(lower))) return 'VACANCY';
    return 'OTHER';
  }

  /** +998 formatlari: +998 90 123 45 67, 998901234567, 90 123-45-67 */
  extractPhones(text: string): string[] {
    const phones = new Set<string>();

    // To'liq format: +998 yoki 998 bilan
    const fullRe = /(?:\+?998)[\s\-()]*(\d{2})[\s\-()]*(\d{3})[\s\-()]*(\d{2})[\s\-()]*(\d{2})/g;
    for (const m of text.matchAll(fullRe)) {
      phones.add(`998${m[1]}${m[2]}${m[3]}${m[4]}`);
    }

    // Qisqa format: 90 123 45 67 (operator prefiks bilan boshlanadi)
    const shortRe = /(?<!\d)(\d{2})[\s\-()]+(\d{3})[\s\-()]*(\d{2})[\s\-()]*(\d{2})(?!\d)/g;
    for (const m of text.matchAll(shortRe)) {
      if (OPERATOR_PREFIXES.has(m[1])) {
        phones.add(`998${m[1]}${m[2]}${m[3]}${m[4]}`);
      }
    }

    return [...phones];
  }

  extractTgContact(text: string): string | undefined {
    const match = text.match(/@([a-zA-Z][a-zA-Z0-9_]{4,31})/);
    return match ? `@${match[1]}` : undefined;
  }

  /**
   * Maosh parsing: "3 mln", "3.000.000", "3 000 000 so'm", "300$", "300-500$",
   * "от 3 до 5 млн", "kelishilgan" -> aniqlanmaydi (undefined)
   */
  extractSalary(lower: string): { min?: number; max?: number; currency: 'UZS' | 'USD' } {
    if (/kelishil|келишил|договорн|kelishuv asosida/.test(lower)) {
      return { currency: 'UZS' };
    }

    // Diapazon: "3-5 mln", "300-500 $", "3 dan 5 mln gacha", "от 300 до 500"
    const rangeRe =
      /(\d[\d\s.,']{0,12}\d|\d)\s*(?:-|–|—|dan|до|to)\s*(\d[\d\s.,']{0,12}\d|\d)\s*(mln|million|млн|ming|тыс|\$|usd|dollar)/i;
    const rangeMatch = lower.match(rangeRe);
    if (rangeMatch) {
      const unit = rangeMatch[3];
      const min = this.toAmount(rangeMatch[1], unit);
      const max = this.toAmount(rangeMatch[2], unit);
      if (min && max && min <= max) {
        return { min, max, currency: this.unitCurrency(unit) };
      }
    }

    // Yakka qiymat: "3 mln", "3.000.000 so'm", "500$"
    const singleRe =
      /(\d[\d\s.,']{0,12}\d|\d)\s*(mln|million|млн|ming|тыс|\$|usd|dollar|so'?m|сум|sum)/gi;
    const candidates: Array<{ value: number; currency: 'UZS' | 'USD' }> = [];
    for (const m of lower.matchAll(singleRe)) {
      const value = this.toAmount(m[1], m[2]);
      if (value) candidates.push({ value, currency: this.unitCurrency(m[2]) });
    }
    if (candidates.length > 0) {
      // eng katta UZS qiymati yoki birinchi USD
      const usd = candidates.find((c) => c.currency === 'USD');
      if (usd) return { min: usd.value, currency: 'USD' };
      const best = candidates.reduce((a, b) => (b.value > a.value ? b : a));
      // 100 ming so'mdan kichik qiymatlar maosh emas (yosh, soat ...)
      if (best.value >= 100_000) return { min: best.value, currency: 'UZS' };
    }

    return { currency: 'UZS' };
  }

  private toAmount(raw: string, unit: string): number | undefined {
    const cleaned = raw.replace(/[\s.,']/g, '');
    const num = Number(cleaned);
    if (!Number.isFinite(num) || num <= 0) return undefined;
    const u = unit.toLowerCase();
    if (u === 'mln' || u === 'million' || u === 'млн') return num * 1_000_000;
    if (u === 'ming' || u === 'тыс') return num * 1_000;
    return num;
  }

  private unitCurrency(unit: string): 'UZS' | 'USD' {
    const u = unit.toLowerCase();
    return u === '$' || u === 'usd' || u === 'dollar' ? 'USD' : 'UZS';
  }

  /** Viloyatni shahar lug'ati orqali aniqlash (lotin + kirill) */
  detectRegion(lower: string): { code: string; isRemote: boolean; district?: string } {
    if (REMOTE_KEYWORDS.some((k) => lower.includes(k))) {
      return { code: REGION_CODES.REMOTE, isRemote: true };
    }

    // uzunroq nomlar birinchi tekshiriladi ("toshkent viloyati" > "toshkent")
    const entries = Object.entries(CITY_TO_REGION).sort((a, b) => b[0].length - a[0].length);

    // viloyat nomi to'g'ridan-to'g'ri "X viloyati" ko'rinishida kelsa
    const vilMatch = lower.match(/([a-z'ʼа-яқўғҳ]+)\s+(viloyati|вилояти|область|обл\.)/i);
    if (vilMatch) {
      const name = vilMatch[1];
      for (const [city, code] of entries) {
        if (name === city) return { code, isRemote: false };
      }
    }

    for (const [city, code] of entries) {
      const cityWord = city.replace(/_/g, ' ');
      if (lower.includes(cityWord)) {
        // shahar/tuman nomi district sifatida saqlanadi
        return { code, isRemote: false, district: this.capitalize(cityWord) };
      }
    }

    return { code: REGION_CODES.OTHER, isRemote: false };
  }

  detectCategory(lower: string): string | undefined {
    let best: { code: string; hits: number } | undefined;
    for (const cat of CATEGORIES) {
      if (cat.keywords.length === 0) continue;
      const hits = cat.keywords.filter((k) => lower.includes(k)).length;
      if (hits > 0 && (!best || hits > best.hits)) {
        best = { code: cat.code, hits };
      }
    }
    return best?.code;
  }

  detectEmploymentType(
    lower: string,
    isRemote: boolean,
  ): ExtractedVacancy['employmentType'] {
    if (isRemote) return 'REMOTE';
    if (/yarim\s+stavka|ярим\s+ставка|неполный\s+день|part[\s-]?time|qisman\s+bandlik/.test(lower)) {
      return 'PART_TIME';
    }
    if (/smen|смен|navbatchilik|вахт/.test(lower)) return 'SHIFT';
    return 'FULL_TIME';
  }

  /** Sarlavha: birinchi mazmunli qator, 80 belgigacha */
  extractTitle(text: string): string {
    const lines = text
      .split('\n')
      .map((l) => this.normalize.normalize(l))
      .filter((l) => l.length >= 3);
    const first = lines[0] ?? this.normalize.normalize(text).slice(0, 80);
    return this.capitalize(first.slice(0, 80).trim());
  }

  /** RESUME postlardan qo'shimcha maydonlar */
  extractResumeFields(text: string): NonNullable<ExtractedVacancy['resume']> {
    const lower = text.toLowerCase();

    const ageMatch = lower.match(/(\d{2})\s*(yosh|ёш|лет|года)/);
    const age = ageMatch ? Number(ageMatch[1]) : undefined;

    const expMatch = lower.match(/(\d{1,2})\s*(yil|йил|год|лет)[^.]{0,20}(tajriba|тажриба|опыт|staj)/);
    const expMatch2 = lower.match(/(tajriba|тажриба|опыт)[^\d]{0,15}(\d{1,2})\s*(yil|йил|год|лет)/);
    const experienceYears = expMatch
      ? Number(expMatch[1])
      : expMatch2
        ? Number(expMatch2[2])
        : undefined;

    const nameMatch = text.match(
      /(?:ismim|исмим|меня зовут|mening ismim)[:\s]+([A-ZА-ЯЎҚҒҲ][a-zа-яўқғҳ']+(?:\s+[A-ZА-ЯЎҚҒҲ][a-zа-яўқғҳ']+)?)/iu,
    );

    return {
      fullName: nameMatch?.[1],
      age: age && age >= 14 && age <= 70 ? age : undefined,
      experienceYears,
    };
  }

  private capitalize(s: string): string {
    return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
  }
}
