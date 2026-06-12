-- Monetizatsiya enumlari
DO $$ BEGIN CREATE TYPE "PlanCode" AS ENUM ('FREE','PREMIUM_SEEKER','EMPLOYER_BASIC','EMPLOYER_PRO'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "PaymentProvider" AS ENUM ('PAYME','CLICK','MANUAL'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "PaymentStatus" AS ENUM ('PENDING','PAID','FAILED','REFUNDED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "PaymentPurpose" AS ENUM ('SUBSCRIPTION','FEATURED_VACANCY','FEATURED_RESUME','RESUME_ACCESS'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- plans
CREATE TABLE IF NOT EXISTS "plans" (
  "id" TEXT NOT NULL,
  "code" "PlanCode" NOT NULL,
  "name" TEXT NOT NULL,
  "priceUzs" INTEGER NOT NULL DEFAULT 0,
  "durationDays" INTEGER NOT NULL DEFAULT 30,
  "vacancyLimit" INTEGER,
  "resumeAccess" BOOLEAN NOT NULL DEFAULT false,
  "features" TEXT[],
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "plans_code_key" ON "plans" ("code");

-- subscriptions
CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "subscriptions_userId_active_idx" ON "subscriptions" ("userId","active");

-- payments
CREATE TABLE IF NOT EXISTS "payments" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "amountUzs" INTEGER NOT NULL,
  "provider" "PaymentProvider" NOT NULL DEFAULT 'MANUAL',
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "purpose" "PaymentPurpose" NOT NULL,
  "referenceId" TEXT,
  "providerTxnId" TEXT,
  "meta" JSONB,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "payments_status_idx" ON "payments" ("status");
CREATE INDEX IF NOT EXISTS "payments_userId_idx" ON "payments" ("userId");
CREATE INDEX IF NOT EXISTS "payments_createdAt_idx" ON "payments" ("createdAt");

-- discovered_channels
CREATE TABLE IF NOT EXISTS "discovered_channels" (
  "id" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "mentions" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "firstSeenIn" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "discovered_channels_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "discovered_channels_username_key" ON "discovered_channels" ("username");
CREATE INDEX IF NOT EXISTS "discovered_channels_status_mentions_idx" ON "discovered_channels" ("status","mentions");

-- vacancies / resumes: featured
ALTER TABLE "vacancies" ADD COLUMN IF NOT EXISTS "featured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "vacancies" ADD COLUMN IF NOT EXISTS "promotedUntil" TIMESTAMP(3);
ALTER TABLE "resumes" ADD COLUMN IF NOT EXISTS "featured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "resumes" ADD COLUMN IF NOT EXISTS "promotedUntil" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "vacancies_status_featured_createdAt_idx" ON "vacancies" ("status","featured","createdAt");

-- FK lar
DO $$ BEGIN ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "payments" ADD CONSTRAINT "payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app_users"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
