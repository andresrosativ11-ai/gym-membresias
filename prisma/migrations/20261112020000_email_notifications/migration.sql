-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "notifyEmail" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "emailEnabled" BOOLEAN NOT NULL DEFAULT false;

