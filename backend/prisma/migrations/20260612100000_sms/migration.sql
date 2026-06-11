-- SMS enumlar
DO $$ BEGIN
  CREATE TYPE "SmsProvider" AS ENUM ('ESKIZ', 'PLAYMOBILE', 'CUSTOM');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "SmsStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- sms_settings
CREATE TABLE IF NOT EXISTS "sms_settings" (
  "id" TEXT NOT NULL,
  "provider" "SmsProvider" NOT NULL DEFAULT 'ESKIZ',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "login" TEXT,
  "password" TEXT,
  "token" TEXT,
  "tokenExpiry" TIMESTAMP(3),
  "sender" TEXT,
  "baseUrl" TEXT,
  "balance" DOUBLE PRECISION,
  "notifyOnPublish" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sms_settings_pkey" PRIMARY KEY ("id")
);

-- sms_logs
CREATE TABLE IF NOT EXISTS "sms_logs" (
  "id" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "status" "SmsStatus" NOT NULL DEFAULT 'PENDING',
  "providerMessageId" TEXT,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sms_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "sms_logs_status_idx" ON "sms_logs" ("status");
CREATE INDEX IF NOT EXISTS "sms_logs_createdAt_idx" ON "sms_logs" ("createdAt");
