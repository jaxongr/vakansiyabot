import { NormalizeService } from './normalize.service';

describe('NormalizeService', () => {
  const service = new NormalizeService();

  describe('normalize', () => {
    it('emojilarni olib tashlaydi', () => {
      expect(service.normalize('💼 Oshpaz kerak 🔥🔥')).toBe('oshpaz kerak');
    });
    it('URL larni olib tashlaydi', () => {
      expect(service.normalize('Batafsil: https://example.com/job?id=1 shu yerda')).toBe(
        'batafsil: shu yerda',
      );
    });
    it('t.me havolalarni olib tashlaydi', () => {
      expect(service.normalize('Kanal t.me/ishbor obuna')).toBe('kanal obuna');
    });
    it('@username imzolarni olib tashlaydi', () => {
      expect(service.normalize('Oshpaz kerak @ish_kanali')).toBe('oshpaz kerak');
    });
    it('ortiqcha bo`shliqlarni bittaga keltiradi', () => {
      expect(service.normalize('a   b\n\n  c')).toBe('a b c');
    });
    it('dekorativ belgilarni tozalaydi', () => {
      expect(service.normalize('▪️Ish ▪️joyi —— Toshkent')).toBe('ish joyi toshkent');
    });
  });

  describe('hash', () => {
    it('bir xil mazmun har xil bezakda bir xil hash', () => {
      const a = service.hash('💼 Oshpaz kerak! Tel: +998901234567 @kanal1');
      const b = service.hash('Oshpaz kerak!   Tel: +998901234567 @kanal2');
      expect(a).toBe(b);
    });
    it('boshqa matn boshqa hash', () => {
      expect(service.hash('Oshpaz kerak')).not.toBe(service.hash('Haydovchi kerak'));
    });
    it('64 belgili hex', () => {
      expect(service.hash('test')).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('normalizePhone', () => {
    it('9 xonali raqamga 998 qo`shadi', () => {
      expect(service.normalizePhone('90 123 45 67')).toBe('998901234567');
    });
    it('+998 formatni tozalaydi', () => {
      expect(service.normalizePhone('+998 (90) 123-45-67')).toBe('998901234567');
    });
    it('to`g`ri formatni o`zgartirmaydi', () => {
      expect(service.normalizePhone('998901234567')).toBe('998901234567');
    });
  });

  describe('tokens', () => {
    it('so`zlarga ajratadi, 1 belgili tokenlarni tashlaydi', () => {
      expect(service.tokens('Oshpaz kerak, 5 mln!')).toEqual(['oshpaz', 'kerak', 'mln']);
    });
  });
});
