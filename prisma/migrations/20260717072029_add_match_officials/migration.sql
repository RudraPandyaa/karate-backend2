/*
  Warnings:

  - Changed the type of `round` on the `Match` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MatchRound" ADD VALUE 'FINAL_MATCH';
ALTER TYPE "MatchRound" ADD VALUE 'QUARTERFINAL';
ALTER TYPE "MatchRound" ADD VALUE 'SEMIFINAL';

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "refereeId" TEXT,
ADD COLUMN     "scorekeeperId" TEXT,
DROP COLUMN "round",
ADD COLUMN     "round" "MatchRound" NOT NULL;

-- CreateTable
CREATE TABLE "TournamentSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "mercyRuleGap" INTEGER NOT NULL DEFAULT 8,
    "matchDurationSeconds" INTEGER NOT NULL DEFAULT 180,
    "senshuEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentSettings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_scorekeeperId_fkey" FOREIGN KEY ("scorekeeperId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
