DO $$ BEGIN
  CREATE TYPE "ApplicationStatus" AS ENUM ('NEW','VIEWED','SHORTLISTED','REJECTED','HIRED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- applications
CREATE TABLE IF NOT EXISTS "applications" (
  "id" TEXT NOT NULL,
  "vacancyId" TEXT NOT NULL,
  "applicantId" TEXT NOT NULL,
  "resumeId" TEXT,
  "phone" TEXT,
  "coverNote" TEXT,
  "status" "ApplicationStatus" NOT NULL DEFAULT 'NEW',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "applications_vacancyId_applicantId_key" ON "applications" ("vacancyId","applicantId");
CREATE INDEX IF NOT EXISTS "applications_vacancyId_status_idx" ON "applications" ("vacancyId","status");
CREATE INDEX IF NOT EXISTS "applications_applicantId_idx" ON "applications" ("applicantId");

-- saved_searches
CREATE TABLE IF NOT EXISTS "saved_searches" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT,
  "regionId" TEXT,
  "categoryId" TEXT,
  "salaryMin" INTEGER,
  "employmentType" "EmploymentType",
  "q" TEXT,
  "notify" BOOLEAN NOT NULL DEFAULT true,
  "lastNotifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "saved_searches_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "saved_searches_userId_idx" ON "saved_searches" ("userId");
CREATE INDEX IF NOT EXISTS "saved_searches_notify_idx" ON "saved_searches" ("notify");

-- FK
DO $$ BEGIN ALTER TABLE "applications" ADD CONSTRAINT "applications_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "vacancies"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "applications" ADD CONSTRAINT "applications_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "applications" ADD CONSTRAINT "applications_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "resumes"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
