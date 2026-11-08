-- AlterEnum
ALTER TYPE "AdminRole" ADD VALUE 'MANAGER';

-- AlterTable
ALTER TABLE "admin_users" ADD COLUMN     "name" TEXT,
ADD COLUMN     "phone" TEXT;
