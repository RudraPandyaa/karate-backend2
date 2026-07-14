/*
  Warnings:

  - Added the required column `exchangeId` to the `ScoreEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `wasUndone` to the `ScoreEvent` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "senshuLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "senshuScoreEventId" TEXT;

-- AlterTable
ALTER TABLE "ScoreEvent" ADD COLUMN     "exchangeId" TEXT NOT NULL,
ADD COLUMN     "wasUndone" BOOLEAN NOT NULL;
