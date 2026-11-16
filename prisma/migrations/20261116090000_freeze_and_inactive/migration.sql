-- Congelar membresías y socios inactivos.
ALTER TYPE "CheckInResult" ADD VALUE 'DENIED_FROZEN';

ALTER TABLE "Member" ADD COLUMN "frozenSince" DATE,
ADD COLUMN "frozenReason" TEXT;

ALTER TABLE "Settings" ADD COLUMN "inactiveDays" INTEGER NOT NULL DEFAULT 10;

CREATE TABLE "MembershipFreeze" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "days" INTEGER NOT NULL,
    "reason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipFreeze_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MembershipFreeze_memberId_startDate_idx" ON "MembershipFreeze"("memberId", "startDate");

ALTER TABLE "MembershipFreeze" ADD CONSTRAINT "MembershipFreeze_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MembershipFreeze" ADD CONSTRAINT "MembershipFreeze_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
