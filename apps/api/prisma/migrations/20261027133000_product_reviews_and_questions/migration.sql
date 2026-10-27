-- The review models already exist in schema.prisma; make clean deployments
-- reproducible. IF NOT EXISTS also accommodates databases initialized by db push.
DO $$ BEGIN
  CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SPAM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "QuestionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "product_reviews" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "customerId" TEXT,
  "authorName" TEXT NOT NULL,
  "authorEmail" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "title" TEXT,
  "content" TEXT NOT NULL,
  "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "isVerifiedPurchase" BOOLEAN NOT NULL DEFAULT false,
  "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
  "helpfulCount" INTEGER NOT NULL DEFAULT 0,
  "adminReply" TEXT,
  "adminRepliedAt" TIMESTAMP(3),
  "adminReplyAuthor" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "product_reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_reviews_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "product_reviews_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "product_reviews_productId_status_idx" ON "product_reviews"("productId", "status");
CREATE INDEX IF NOT EXISTS "product_reviews_status_createdAt_idx" ON "product_reviews"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "product_reviews_authorEmail_idx" ON "product_reviews"("authorEmail");

CREATE TABLE IF NOT EXISTS "product_questions" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "customerId" TEXT,
  "authorName" TEXT NOT NULL,
  "authorEmail" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "answer" TEXT,
  "isAnswered" BOOLEAN NOT NULL DEFAULT false,
  "answeredAt" TIMESTAMP(3),
  "answeredBy" TEXT,
  "status" "QuestionStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "product_questions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_questions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "product_questions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "product_questions_productId_status_idx" ON "product_questions"("productId", "status");
CREATE INDEX IF NOT EXISTS "product_questions_status_createdAt_idx" ON "product_questions"("status", "createdAt");
