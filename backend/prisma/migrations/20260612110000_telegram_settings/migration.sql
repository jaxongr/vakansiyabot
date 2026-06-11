CREATE TABLE IF NOT EXISTS "telegram_settings" (
  "id" TEXT NOT NULL,
  "apiId" INTEGER,
  "apiHash" TEXT,
  "session" TEXT,
  "collectorPhone" TEXT,
  "collectorEnabled" BOOLEAN NOT NULL DEFAULT false,
  "collectorStatus" TEXT,
  "botToken" TEXT,
  "botUsername" TEXT,
  "publishGroupId" TEXT,
  "adminIds" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "telegram_settings_pkey" PRIMARY KEY ("id")
);
