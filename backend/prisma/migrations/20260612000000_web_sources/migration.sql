-- Origin enumiga WEB qiymati
ALTER TYPE "Origin" ADD VALUE IF NOT EXISTS 'WEB';

-- Yangi enumlar
DO $$ BEGIN
  CREATE TYPE "WebSourceType" AS ENUM ('ISHUZ', 'OLX', 'HHUZ', 'GENERIC_RSS');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "WebSourceStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ERROR');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- web_sources jadvali
CREATE TABLE IF NOT EXISTS "web_sources" (
  "id" TEXT NOT NULL,
  "type" "WebSourceType" NOT NULL,
  "name" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "status" "WebSourceStatus" NOT NULL DEFAULT 'ACTIVE',
  "intervalMin" INTEGER NOT NULL DEFAULT 30,
  "lastScrapedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "postsCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "web_sources_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "web_sources_status_idx" ON "web_sources" ("status");

-- raw_posts ustunlari
ALTER TABLE "raw_posts" ADD COLUMN IF NOT EXISTS "origin" "Origin" NOT NULL DEFAULT 'CHANNEL';
ALTER TABLE "raw_posts" ADD COLUMN IF NOT EXISTS "webSourceId" TEXT;
ALTER TABLE "raw_posts" ADD COLUMN IF NOT EXISTS "externalId" TEXT;
ALTER TABLE "raw_posts" ADD COLUMN IF NOT EXISTS "externalUrl" TEXT;

-- channelId va tgMessageId endi ixtiyoriy (WEB origin uchun)
ALTER TABLE "raw_posts" ALTER COLUMN "channelId" DROP NOT NULL;
ALTER TABLE "raw_posts" ALTER COLUMN "tgMessageId" DROP NOT NULL;

-- WEB e'lonlari takrorlanmasligi uchun
CREATE UNIQUE INDEX IF NOT EXISTS "raw_posts_webSourceId_externalId_key"
  ON "raw_posts" ("webSourceId", "externalId");

-- FK
DO $$ BEGIN
  ALTER TABLE "raw_posts" ADD CONSTRAINT "raw_posts_webSourceId_fkey"
    FOREIGN KEY ("webSourceId") REFERENCES "web_sources" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
