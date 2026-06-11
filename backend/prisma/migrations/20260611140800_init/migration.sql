-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('CHANNEL', 'GROUP');

-- CreateEnum
CREATE TYPE "ChannelStatus" AS ENUM ('ACTIVE', 'PAUSED', 'BANNED');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('UZS', 'USD');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'REMOTE', 'SHIFT');

-- CreateEnum
CREATE TYPE "VacancyStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "DedupReviewStatus" AS ENUM ('PENDING', 'MERGED', 'SEPARATED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateTable
CREATE TABLE "channels" (
    "id" TEXT NOT NULL,
    "tgId" BIGINT NOT NULL,
    "username" TEXT,
    "title" TEXT NOT NULL,
    "type" "ChannelType" NOT NULL,
    "status" "ChannelStatus" NOT NULL DEFAULT 'ACTIVE',
    "postsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_posts" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "tgMessageId" BIGINT NOT NULL,
    "text" TEXT NOT NULL,
    "textHash" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "isVacancy" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "raw_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vacancies" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "company" TEXT,
    "regionId" TEXT NOT NULL,
    "district" TEXT,
    "categoryId" TEXT NOT NULL,
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "currency" "Currency" NOT NULL DEFAULT 'UZS',
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
    "phones" TEXT[],
    "tgContact" TEXT,
    "status" "VacancyStatus" NOT NULL DEFAULT 'ACTIVE',
    "simhash" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "vacancies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vacancy_sources" (
    "vacancyId" TEXT NOT NULL,
    "rawPostId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vacancy_sources_pkey" PRIMARY KEY ("vacancyId","rawPostId")
);

-- CreateTable
CREATE TABLE "regions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameUz" TEXT NOT NULL,
    "nameCyr" TEXT NOT NULL,
    "tgTopicId" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameUz" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_users" (
    "id" TEXT NOT NULL,
    "tgUserId" BIGINT NOT NULL,
    "username" TEXT,
    "firstName" TEXT,
    "regionId" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "refreshTokenHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "app_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_vacancies" (
    "userId" TEXT NOT NULL,
    "vacancyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_vacancies_pkey" PRIMARY KEY ("userId","vacancyId")
);

-- CreateTable
CREATE TABLE "published_posts" (
    "id" TEXT NOT NULL,
    "vacancyId" TEXT NOT NULL,
    "tgChatId" BIGINT NOT NULL,
    "tgMessageId" INTEGER NOT NULL,
    "tgTopicId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "published_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dedup_reviews" (
    "id" TEXT NOT NULL,
    "vacancyAId" TEXT NOT NULL,
    "vacancyBId" TEXT NOT NULL,
    "similarity" DOUBLE PRECISION NOT NULL,
    "status" "DedupReviewStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dedup_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "channels_tgId_key" ON "channels"("tgId");

-- CreateIndex
CREATE INDEX "channels_status_idx" ON "channels"("status");

-- CreateIndex
CREATE INDEX "raw_posts_processed_idx" ON "raw_posts"("processed");

-- CreateIndex
CREATE INDEX "raw_posts_textHash_idx" ON "raw_posts"("textHash");

-- CreateIndex
CREATE UNIQUE INDEX "raw_posts_channelId_tgMessageId_key" ON "raw_posts"("channelId", "tgMessageId");

-- CreateIndex
CREATE INDEX "vacancies_regionId_status_createdAt_idx" ON "vacancies"("regionId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "vacancies_categoryId_status_idx" ON "vacancies"("categoryId", "status");

-- CreateIndex
CREATE INDEX "vacancies_status_createdAt_idx" ON "vacancies"("status", "createdAt");

-- CreateIndex
CREATE INDEX "vacancies_simhash_idx" ON "vacancies"("simhash");

-- CreateIndex
CREATE UNIQUE INDEX "regions_code_key" ON "regions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "categories_code_key" ON "categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "app_users_tgUserId_key" ON "app_users"("tgUserId");

-- CreateIndex
CREATE UNIQUE INDEX "published_posts_vacancyId_key" ON "published_posts"("vacancyId");

-- CreateIndex
CREATE INDEX "published_posts_vacancyId_idx" ON "published_posts"("vacancyId");

-- CreateIndex
CREATE INDEX "dedup_reviews_status_idx" ON "dedup_reviews"("status");

-- AddForeignKey
ALTER TABLE "raw_posts" ADD CONSTRAINT "raw_posts_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacancies" ADD CONSTRAINT "vacancies_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacancies" ADD CONSTRAINT "vacancies_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacancy_sources" ADD CONSTRAINT "vacancy_sources_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "vacancies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacancy_sources" ADD CONSTRAINT "vacancy_sources_rawPostId_fkey" FOREIGN KEY ("rawPostId") REFERENCES "raw_posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_users" ADD CONSTRAINT "app_users_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_vacancies" ADD CONSTRAINT "saved_vacancies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_vacancies" ADD CONSTRAINT "saved_vacancies_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "vacancies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "published_posts" ADD CONSTRAINT "published_posts_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "vacancies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dedup_reviews" ADD CONSTRAINT "dedup_reviews_vacancyAId_fkey" FOREIGN KEY ("vacancyAId") REFERENCES "vacancies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dedup_reviews" ADD CONSTRAINT "dedup_reviews_vacancyBId_fkey" FOREIGN KEY ("vacancyBId") REFERENCES "vacancies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
