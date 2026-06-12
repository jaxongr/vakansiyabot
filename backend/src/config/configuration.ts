import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://127.0.0.1:6379'),

  TG_API_ID: z.coerce.number().optional(),
  TG_API_HASH: z.string().optional(),
  TG_SESSION: z.string().optional(),

  BOT_TOKEN: z.string().optional(),
  BOT_USERNAME: z.string().optional(),
  PUBLISH_GROUP_ID: z.string().optional(),

  ANTHROPIC_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().default('claude-haiku-4-5-20251001'),

  JWT_ACCESS_SECRET: z.string().min(8),
  JWT_REFRESH_SECRET: z.string().min(8),

  ADMIN_TG_IDS: z.string().default(''),

  MINIAPP_URL: z.string().default('http://localhost:5173'),
  DASHBOARD_URL: z.string().default('http://localhost:5174'),

  SENTRY_DSN: z.string().optional(),

  // To'lov provayderlari (O'zbekiston)
  PAYME_MERCHANT_ID: z.string().optional(),
  PAYME_MERCHANT_KEY: z.string().optional(), // webhook Basic auth uchun
  CLICK_MERCHANT_ID: z.string().optional(),
  CLICK_SERVICE_ID: z.string().optional(),
  CLICK_SECRET_KEY: z.string().optional(), // webhook imzo uchun
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }
  return parsed.data;
}

export function parseAdminIds(raw: string): number[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isFinite(n));
}
