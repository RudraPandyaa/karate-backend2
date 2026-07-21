/*
  Warnings:

  - The `nextCorner` column on the `Match` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MatchRound" ADD VALUE 'ROUND_3';
ALTER TYPE "MatchRound" ADD VALUE 'REPECHAGE';
ALTER TYPE "MatchRound" ADD VALUE 'FINAL_MATCH';
ALTER TYPE "MatchRound" ADD VALUE 'QUARTERFINAL';
ALTER TYPE "MatchRound" ADD VALUE 'SEMIFINAL';

-- AlterTable
ALTER TABLE "Match" DROP COLUMN "nextCorner",
ADD COLUMN     "nextCorner" "Corner";

-- DropEnum
DROP TYPE "MatchCorner";
