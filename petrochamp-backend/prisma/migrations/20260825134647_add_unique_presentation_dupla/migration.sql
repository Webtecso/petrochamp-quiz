/*
  Warnings:

  - A unique constraint covering the columns `[championship,round,slot]` on the table `BracketMatch` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[phaseId,teamAId]` on the table `PresentationDupla` will be added. If there are existing duplicate values, this will fail.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Phase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "championship" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'quiz',
    "useQuestions" BOOLEAN NOT NULL DEFAULT true,
    "useJudges" BOOLEAN NOT NULL DEFAULT false,
    "maxQuestions" INTEGER,
    "questionsPerTeam" INTEGER,
    "avoidRepeatQuestions" BOOLEAN NOT NULL DEFAULT true,
    "useInitialScores" BOOLEAN NOT NULL DEFAULT false,
    "initialScoreMaxPoints" INTEGER,
    "presentationMinutes" INTEGER,
    "presentationWeight" INTEGER DEFAULT 50,
    "quizWeight" INTEGER DEFAULT 50,
    "noElimination" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);
INSERT INTO "new_Phase" ("avoidRepeatQuestions", "championship", "createdAt", "deletedAt", "id", "initialScoreMaxPoints", "label", "maxQuestions", "order", "presentationMinutes", "presentationWeight", "questionsPerTeam", "quizWeight", "type", "updatedAt", "useInitialScores", "useJudges", "useQuestions") SELECT "avoidRepeatQuestions", "championship", "createdAt", "deletedAt", "id", "initialScoreMaxPoints", "label", "maxQuestions", "order", "presentationMinutes", "presentationWeight", "questionsPerTeam", "quizWeight", "type", "updatedAt", "useInitialScores", "useJudges", "useQuestions" FROM "Phase";
DROP TABLE "Phase";
ALTER TABLE "new_Phase" RENAME TO "Phase";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "BracketMatch_championship_round_slot_key" ON "BracketMatch"("championship", "round", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "PresentationDupla_phaseId_teamAId_key" ON "PresentationDupla"("phaseId", "teamAId");
