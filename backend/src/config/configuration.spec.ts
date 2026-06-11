import { parseAdminIds, validateEnv } from './configuration';

describe('configuration', () => {
  describe('validateEnv', () => {
    const base = {
      DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
      JWT_ACCESS_SECRET: 'access-secret',
      JWT_REFRESH_SECRET: 'refresh-secret',
    };

    it('to`g`ri env -> default qiymatlar bilan', () => {
      const env = validateEnv(base);
      expect(env.PORT).toBe(3000);
      expect(env.NODE_ENV).toBe('development');
      expect(env.LLM_MODEL).toContain('claude');
      expect(env.REDIS_URL).toBe('redis://127.0.0.1:6379');
    });

    it('DATABASE_URL yo`q -> xato', () => {
      expect(() => validateEnv({ ...base, DATABASE_URL: undefined })).toThrow();
    });

    it('qisqa JWT secret -> xato', () => {
      expect(() => validateEnv({ ...base, JWT_ACCESS_SECRET: 'qisqa' })).toThrow();
    });

    it('PORT string -> raqamga aylantiradi', () => {
      const env = validateEnv({ ...base, PORT: '4000' });
      expect(env.PORT).toBe(4000);
    });
  });

  describe('parseAdminIds', () => {
    it('vergulli ro`yxatni raqamlarga aylantiradi', () => {
      expect(parseAdminIds('111, 222 ,333')).toEqual([111, 222, 333]);
    });
    it('bo`sh -> bo`sh massiv', () => {
      expect(parseAdminIds('')).toEqual([]);
    });
    it('yaroqsiz qiymatlarni tashlaydi', () => {
      expect(parseAdminIds('111,abc,222')).toEqual([111, 222]);
    });
  });
});
