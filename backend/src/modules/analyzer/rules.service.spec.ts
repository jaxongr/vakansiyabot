import { RulesService } from './rules.service';
import { NormalizeService } from '../dedup/normalize.service';

describe('RulesService', () => {
  const rules = new RulesService(new NormalizeService());

  describe('detectKind — post turini aniqlash', () => {
    const cases: Array<[string, string, 'VACANCY' | 'RESUME' | 'OTHER']> = [
      ['oddiy vakansiya', 'Oshpaz kerak. Maosh 4 mln. Tel: +998901234567', 'VACANCY'],
      ['talab qilinadi', 'Quruvchilar talab qilinadi, Samarqand shahri', 'VACANCY'],
      ['rus tilida vakansiya', 'Требуется продавец в магазин. Зарплата 3 млн', 'VACANCY'],
      ['kirill vakansiya', 'Ҳайдовчи керак, Тошкент шаҳри, ойлик 5 млн', 'VACANCY'],
      ['hashtag vakansiya', '#vakansiya Sotuvchi qiz kerak Chilonzor', 'VACANCY'],
      ['ish izlayman — rezyume', 'Ish izlayapman. 25 yosh, haydovchilik guvohnomam bor', 'RESUME'],
      ['ish kerak — rezyume', 'Menga ish kerak, qurilishda 5 yil tajribam bor', 'RESUME'],
      ['rus rezyume', 'Ищу работу водителем, опыт 10 лет, Ташкент', 'RESUME'],
      ['rezyume hashtag', '#rezyume Buxgalter, 7 yil tajriba, Andijon', 'RESUME'],
      ['ishchi kerak — bu vakansiya, rezyume EMAS', 'Ishchi kerak zavodga, oylik 3 mln', 'VACANCY'],
      ['reklama', "Kanalimizga obuna bo'ling! Eng zo'r chegirmalar bizda", 'OTHER'],
      ['aksiya', 'AKSIYA! 50% skidka barcha mahsulotlarga', 'OTHER'],
      ['yangilik', "Bugun Toshkentda ob-havo issiq bo'ladi", 'OTHER'],
      ['konkurs', 'Konkurs! Sovrinli savollarga javob bering', 'OTHER'],
    ];

    it.each(cases)('%s', (_name, text, expected) => {
      expect(rules.analyze(text).extracted.kind).toBe(expected);
    });
  });

  describe('extractPhones — telefon formatlari', () => {
    it('+998 bo`shliqli format', () => {
      expect(rules.extractPhones('Tel: +998 90 123 45 67')).toEqual(['998901234567']);
    });
    it('998 prefiksli yaxlit format', () => {
      expect(rules.extractPhones('Aloqa 998331234567')).toEqual(['998331234567']);
    });
    it('chiziqchali format', () => {
      expect(rules.extractPhones('+998-71-200-00-00')).toEqual(['998712000000']);
    });
    it('qisqa operator format (90 123 45 67)', () => {
      expect(rules.extractPhones('Qo`ng`iroq: 90 123-45-67')).toEqual(['998901234567']);
    });
    it('bir nechta telefon', () => {
      const phones = rules.extractPhones('Tel +998901112233 yoki +998935554411');
      expect(phones).toHaveLength(2);
    });
    it('takror telefon bitta bo`ladi', () => {
      expect(rules.extractPhones('+998901234567 +998 90 123 45 67')).toHaveLength(1);
    });
    it('maosh raqamini telefon deb olmaydi', () => {
      expect(rules.extractPhones('Oylik 3.000.000 so`m')).toEqual([]);
    });
  });

  describe('extractSalary — maosh formatlari', () => {
    it('"4 mln" -> 4 000 000 UZS', () => {
      expect(rules.extractSalary('maosh 4 mln')).toMatchObject({ min: 4_000_000, currency: 'UZS' });
    });
    it('"3.000.000" so`m', () => {
      expect(rules.extractSalary('oylik 3.000.000 som')).toMatchObject({ min: 3_000_000 });
    });
    it('"3 000 000 so`m" bo`shliqli', () => {
      expect(rules.extractSalary("ish haqi 3 000 000 so'm")).toMatchObject({ min: 3_000_000 });
    });
    it('"500$" -> USD', () => {
      expect(rules.extractSalary('oylik 500$')).toMatchObject({ min: 500, currency: 'USD' });
    });
    it('diapazon "3-5 mln"', () => {
      expect(rules.extractSalary('maosh 3-5 mln')).toMatchObject({
        min: 3_000_000,
        max: 5_000_000,
      });
    });
    it('"kelishilgan" -> aniqlanmagan', () => {
      const result = rules.extractSalary('maosh kelishilgan holda');
      expect(result.min).toBeUndefined();
    });
    it('rus "млн"', () => {
      expect(rules.extractSalary('зарплата 4 млн')).toMatchObject({ min: 4_000_000 });
    });
    it('kichik raqam (yosh) maosh emas', () => {
      const result = rules.extractSalary('25 yosh, 500 ming');
      expect(result.min).toBe(500_000); // ming ishlaydi, yosh emas
    });
  });

  describe('detectRegion — viloyat aniqlash', () => {
    const cases: Array<[string, string]> = [
      ['Toshkent shahrida ish', 'toshkent-shahri'],
      ['Самарқанд шаҳрига ishchi kerak', 'samarqand'],
      ['Chirchiq zavodiga operator', 'toshkent-viloyati'],
      ['Нукус шаҳри, маош яхши', 'qoraqalpogiston'],
      ["Marg'ilon — Farg'ona... aniqrog'i margilon", 'fargona'],
      ['Urganch shahriga sotuvchi', 'xorazm'],
      ['Бухара, требуется повар', 'buxoro'],
      ['Qarshi shahrida qurilish', 'qashqadaryo'],
      ['Masofaviy ish, kompyuter kerak', 'remote'],
      ['Удаленно, можно из дома', 'remote'],
      ['Viloyat aytilmagan post', 'other'],
    ];

    it.each(cases)('"%s" -> %s', (text, expected) => {
      expect(rules.detectRegion(text.toLowerCase()).code).toBe(expected);
    });
  });

  describe('detectCategory — kategoriya keyword', () => {
    const cases: Array<[string, string]> = [
      ['Frontend developer kerak, React bilasizmi', 'it'],
      ['Sotuvchi kerak supermarketga', 'savdo'],
      ['Haydovchi kerak, Isuzu', 'haydovchi'],
      ['Сварщик требуется на стройку', 'qurilish'],
      ['Tikuvchi xonimlar kerak sexga', 'ishlab-chiqarish'],
      ['Ingliz tili o`qituvchisi kerak', 'talim'],
      ['Hamshira kerak klinikaga', 'tibbiyot'],
      ['Ofitsiant kerak restoranga', 'xizmat'],
      ['Buxgalter kerak, 1C bilish shart', 'buxgalteriya'],
      ['SMM mutaxassis, target sozlash', 'marketing'],
      ['Enaga kerak 2 yoshli bolaga', 'uy-xizmati'],
      ['Qorovul kerak omborga', 'qoriqlash'],
    ];

    it.each(cases)('"%s" -> %s', (text, expected) => {
      expect(rules.detectCategory(text.toLowerCase())).toBe(expected);
    });

    it('hech narsa topilmasa undefined', () => {
      expect(rules.detectCategory('shunchaki matn hech narsasiz')).toBeUndefined();
    });
  });

  describe('extractResumeFields', () => {
    it('yosh va tajribani ajratadi', () => {
      const fields = rules.extractResumeFields(
        'Ish izlayapman. 27 yosh, qurilishda 5 yil tajribam bor',
      );
      expect(fields.age).toBe(27);
      expect(fields.experienceYears).toBe(5);
    });
    it('rus formatida', () => {
      const fields = rules.extractResumeFields('Ищу работу. 30 лет, опыт работы есть');
      expect(fields.age).toBe(30);
    });
    it('ism "ismim X" formatda', () => {
      const fields = rules.extractResumeFields('Mening ismim Jasur, ish izlayapman');
      expect(fields.fullName).toBe('Jasur');
    });
  });

  describe('to`liq analyze oqimi', () => {
    it('to`liq vakansiya postini strukturaga ajratadi', () => {
      const text = [
        '💼 Oshpaz kerak!',
        'Samarqand shahridagi restoranga tajribali oshpaz kerak.',
        'Maosh: 5 mln',
        'Tel: +998 90 123 45 67',
        'Aloqa: @ish_samarqand',
      ].join('\n');

      const { extracted, needsLlm } = rules.analyze(text);

      expect(extracted.kind).toBe('VACANCY');
      expect(extracted.regionCode).toBe('samarqand');
      expect(extracted.categoryCode).toBe('xizmat');
      expect(extracted.salaryMin).toBe(5_000_000);
      expect(extracted.phones).toEqual(['998901234567']);
      expect(extracted.tgContact).toBe('@ish_samarqand');
      expect(extracted.title.toLowerCase()).toContain('oshpaz');
      expect(needsLlm).toBe(false);
    });

    it('ma`lumot yetishmasa needsLlm=true', () => {
      const { needsLlm } = rules.analyze('Ishchi kerak juda zo`r ishga');
      expect(needsLlm).toBe(true); // region ham, telefon ham yo'q
    });

    it('rezyume postni RESUME sifatida strukturalaydi', () => {
      const text = 'Ish izlayapman. 25 yosh. Toshkentda. Haydovchiman, 3 yil tajriba. Tel 998901112233';
      const { extracted } = rules.analyze(text);
      expect(extracted.kind).toBe('RESUME');
      expect(extracted.regionCode).toBe('toshkent-shahri');
      expect(extracted.resume?.age).toBe(25);
      expect(extracted.resume?.experienceYears).toBe(3);
    });
  });
});
