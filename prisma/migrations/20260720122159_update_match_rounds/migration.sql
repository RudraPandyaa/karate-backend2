/*
  Warnings:

  - The values [ROUND_1,ROUND_2,ROUND_3,FINAL_MATCH,QUARTERFINAL,SEMIFINAL] on the enum `MatchRound` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "MatchRound_new" AS ENUM ('ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL', 'REPECHAGE', 'BRONZE');
ALTER TABLE "Match" ALTER COLUMN "round" TYPE "MatchRound_new" USING ("round"::text::"MatchRound_new");
ALTER TYPE "MatchRound" RENAME TO "MatchRound_old";
ALTER TYPE "MatchRound_new" RENAME TO "MatchRound";
DROP TYPE "MatchRound_old";
COMMIT;
