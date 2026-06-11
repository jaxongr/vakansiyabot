import * as dotenvPath from 'path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: dotenvPath.join(__dirname, '..', '.env') });

// E2E testlar alohida bazada ishlaydi
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/vakansiya_test';
process.env.NODE_ENV = 'test';
