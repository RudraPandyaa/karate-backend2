/*
  Warnings:

  - The values [ROUND_3,REPECHAGE,FINAL_MATCH,QUARTERFINAL,SEMIFINAL] on the enum `MatchRound` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "MatchCorner" AS ENUM ('RED', 'BLUE');

-- AlterEnum
BEGIN;
CREATE TYPE "MatchRound_new" AS ENUM ('ROUND_1', 'ROUND_2', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL', 'BRONZE');
ALTER TABLE "Match" ALTER COLUMN "round" TYPE "MatchRound_new" USING ("round"::text::"MatchRound_new");
ALTER TYPE "MatchRound" RENAME TO "MatchRound_old";
ALTER TYPE "MatchRound_new" RENAME TO "MatchRound";
DROP TYPE "MatchRound_old";
COMMIT;

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "nextCorner" TEXT;
