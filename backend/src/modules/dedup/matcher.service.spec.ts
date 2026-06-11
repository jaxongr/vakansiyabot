import { MatcherService } from './matcher.service';
import { NormalizeService } from './normalize.service';

describe('MatcherService', () => {
  const normalize = new NormalizeService();
  const matcher = new MatcherService(normalize);

  const vacancyText = [
    'Oshpaz kerak! Samarqand shahridagi yirik restoranga tajribali oshpaz kerak.',
    'Milliy taomlar: osh, shashlik, lagmon tayyorlay olishi shart.',
    'Ish vaqti 9:00 dan 18:00 gacha, haftada olti kun, yakshanba dam olish.',
    'Yashash joyi bilan taminlaymiz, ovqat bepul, jamoa yaxshi.',
    'Maosh 5 mln som, oyiga bir marta beriladi. Tel +998901234567',
  ].join(' ');

  describe('simhash', () => {
    it('16 belgili hex qaytaradi', () => {
      expect(matcher.simhash(vacancyText)).toMatch(/^[a-f0-9]{16}$/);
    });
    it('bir xil matn — bir xil hash', () => {
      expect(matcher.simhash(vacancyText)).toBe(matcher.simhash(vacancyText));
    });
    it('deyarli bir xil matn — yuqori o`xshashlik (>0.92)', () => {
      const slightlyDifferent = vacancyText.replace('5 mln', '6 mln');
      const sim = matcher.similarity(matcher.simhash(vacancyText), matcher.simhash(slightlyDifferent));
      expect(sim).toBeGreaterThan(0.92);
    });
    it('butunlay boshqa matn — past o`xshashlik (<0.85)', () => {
      const other =
        'Frontend dasturchi izlaymiz. React, TypeScript. Masofaviy. Oylik 1200$. Portfolio @hr_it ga';
      const sim = matcher.similarity(matcher.simhash(vacancyText), matcher.simhash(other));
      expect(sim).toBeLessThan(0.85);
    });
  });

  describe('similarity', () => {
    it('bir xil hash -> 1.0', () => {
      expect(matcher.similarity('ffffffffffffffff', 'ffffffffffffffff')).toBe(1);
    });
    it('to`liq teskari hash -> 0.0', () => {
      expect(matcher.similarity('ffffffffffffffff', '0000000000000000')).toBe(0);
    });
    it('yarmi farq -> 0.5', () => {
      expect(matcher.similarity('ffffffff00000000', '0000000000000000')).toBe(0.5);
    });
  });

  describe('phoneTitleMatch', () => {
    it('telefon va sarlavha mos -> true', () => {
      expect(
        matcher.phoneTitleMatch(
          ['998901234567'],
          '💼 Oshpaz kerak',
          ['+998 90 123 45 67'],
          'Oshpaz kerak!',
        ),
      ).toBe(true);
    });
    it('telefon mos, sarlavha boshqa -> false', () => {
      expect(
        matcher.phoneTitleMatch(['998901234567'], 'Oshpaz kerak', ['998901234567'], 'Haydovchi kerak'),
      ).toBe(false);
    });
    it('telefon yo`q -> false', () => {
      expect(matcher.phoneTitleMatch([], 'Oshpaz', ['998901234567'], 'Oshpaz')).toBe(false);
    });
  });
});
