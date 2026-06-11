/*
  Warnings:

  - You are about to drop the column `isVacancy` on the `raw_posts` table. All the data in the column will be lost.
  - You are about to drop the column `search_vector` on the `vacancies` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "PostKind" AS ENUM ('VACANCY', 'RESUME', 'OTHER');

-- CreateEnum
CREATE TYPE "Origin" AS ENUM ('CHANNEL', 'BOT');

-- DropIndex
DROP INDEX "vacancies_search_vector_idx";

-- AlterTable
ALTER TABLE "raw_posts" DROP COLUMN "isVacancy",
ADD COLUMN     "kind" "PostKind";

-- AlterTable
ALTER TABLE "regions" ADD COLUMN     "special" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "vacancies" DROP COLUMN "search_vector",
ADD COLUMN     "origin" "Origin" NOT NULL DEFAULT 'CHANNEL',
ADD COLUMN     "submittedById" TEXT;

-- CreateTable
CREATE TABLE "resumes" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "age" INTEGER,
    "title" TEXT NOT NULL,
    "about" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "experienceYears" INTEGER,
    "experience" TEXT,
    "education" TEXT,
    "skills" TEXT[],
    "salaryExpectation" INTEGER,
    "currency" "Currency" NOT NULL DEFAULT 'UZS',
    "phones" TEXT[],
    "tgContact" TEXT,
    "status" "VacancyStatus" NOT NULL DEFAULT 'ACTIVE',
    "origin" "Origin" NOT NULL DEFAULT 'CHANNEL',
    "rawPostId" TEXT,
    "submittedById" TEXT,
    "simhash" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "resumes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "published_resumes" (
    "id" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "tgChatId" BIGINT NOT NULL,
    "tgMessageId" INTEGER NOT NULL,
    "tgTopicId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "published_resumes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "resumes_regionId_status_createdAt_idx" ON "resumes"("regionId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "resumes_categoryId_status_idx" ON "resumes"("categoryId", "status");

-- CreateIndex
CREATE INDEX "resumes_status_createdAt_idx" ON "resumes"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "published_resumes_resumeId_key" ON "published_resumes"("resumeId");

-- AddForeignKey
ALTER TABLE "vacancies" ADD CONSTRAINT "vacancies_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "app_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "app_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "published_resumes" ADD CONSTRAINT "published_resumes_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "resumes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
