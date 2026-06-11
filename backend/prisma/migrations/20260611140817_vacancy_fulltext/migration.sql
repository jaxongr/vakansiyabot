-- Full-text qidiruv: title + description ustida generated tsvector + GIN index
ALTER TABLE "vacancies"
  ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("description", '')), 'B')
  ) STORED;

CREATE INDEX "vacancies_search_vector_idx" ON "vacancies" USING GIN ("search_vector");
