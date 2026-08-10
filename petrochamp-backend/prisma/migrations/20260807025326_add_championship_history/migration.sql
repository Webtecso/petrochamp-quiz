-- CreateTable
CREATE TABLE "ChampionshipHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "championship" TEXT NOT NULL,
    "editionName" TEXT NOT NULL,
    "championTeamId" TEXT,
    "championTeamName" TEXT,
    "finalRankingJson" TEXT NOT NULL,
    "matchesJson" TEXT NOT NULL,
    "totalMatches" INTEGER NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- Phase
CREATE TABLE "new_Phase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "championship" TEXT NOT NULL DEFAULT 'geral',
    "order" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "useQuestions" BOOLEAN NOT NULL DEFAULT true,
    "useJudges" BOOLEAN NOT NULL DEFAULT false,
    "maxQuestions" INTEGER,
    "questionsPerTeam" INTEGER,
    "avoidRepeatQuestions" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Phase" ("createdAt", "id", "label", "maxQuestions", "order", "questionsPerTeam", "useJudges", "useQuestions", "championship")
SELECT "createdAt", "id", "label", "maxQuestions", "order", "questionsPerTeam", "useJudges", "useQuestions", 'geral' FROM "Phase";
DROP TABLE "Phase";
ALTER TABLE "new_Phase" RENAME TO "Phase";

-- Question
CREATE TABLE "new_Question" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "championship" TEXT NOT NULL DEFAULT 'geral',
    "text" TEXT NOT NULL,
    "imageUrl" TEXT,
    "optionA" TEXT NOT NULL,
    "optionB" TEXT NOT NULL,
    "optionC" TEXT NOT NULL,
    "optionD" TEXT NOT NULL,
    "correctIndex" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "phase" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Question" ("correctIndex", "createdAt", "id", "imageUrl", "optionA", "optionB", "optionC", "optionD", "phase", "points", "text", "championship")
SELECT "correctIndex", "createdAt", "id", "imageUrl", "optionA", "optionB", "optionC", "optionD", "phase", "points", "text", 'geral' FROM "Question";
DROP TABLE "Question";
ALTER TABLE "new_Question" RENAME TO "Question";

-- TiebreakQuestion
CREATE TABLE "new_TiebreakQuestion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "championship" TEXT NOT NULL DEFAULT 'geral',
    "text" TEXT NOT NULL,
    "imageUrl" TEXT,
    "optionA" TEXT NOT NULL,
    "optionB" TEXT NOT NULL,
    "optionC" TEXT NOT NULL,
    "optionD" TEXT NOT NULL,
    "correctIndex" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "phase" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_TiebreakQuestion" ("correctIndex", "createdAt", "id", "imageUrl", "optionA", "optionB", "optionC", "optionD", "phase", "points", "text", "championship")
SELECT "correctIndex", "createdAt", "id", "imageUrl", "optionA", "optionB", "optionC", "optionD", "phase", "points", "text", 'geral' FROM "TiebreakQuestion";
DROP TABLE "TiebreakQuestion";
ALTER TABLE "new_TiebreakQuestion" RENAME TO "TiebreakQuestion";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
