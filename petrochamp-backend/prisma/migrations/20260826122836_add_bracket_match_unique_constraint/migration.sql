/*
  Warnings:

  - You are about to drop the column `correctIndex` on the `EvaluationItem` table. All the data in the column will be lost.
  - You are about to drop the column `correctIndex` on the `Question` table. All the data in the column will be lost.
  - You are about to drop the column `correctIndex` on the `TiebreakQuestion` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EvaluationItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "championship" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'aberta',
    "text" TEXT NOT NULL,
    "imageUrl" TEXT,
    "optionA" TEXT,
    "optionB" TEXT,
    "optionC" TEXT,
    "optionD" TEXT,
    "optionE" TEXT,
    "optionF" TEXT,
    "optionG" TEXT,
    "optionH" TEXT,
    "correctIndexes" TEXT,
    "timeSeconds" INTEGER,
    "maxPoints" INTEGER NOT NULL,
    "phase" INTEGER NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'single',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);
INSERT INTO "new_EvaluationItem" ("championship", "createdAt", "deletedAt", "id", "imageUrl", "maxPoints", "mode", "optionA", "optionB", "optionC", "optionD", "phase", "scope", "text", "timeSeconds", "type", "updatedAt") SELECT "championship", "createdAt", "deletedAt", "id", "imageUrl", "maxPoints", "mode", "optionA", "optionB", "optionC", "optionD", "phase", "scope", "text", "timeSeconds", "type", "updatedAt" FROM "EvaluationItem";
DROP TABLE "EvaluationItem";
ALTER TABLE "new_EvaluationItem" RENAME TO "EvaluationItem";
CREATE TABLE "new_Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "championship" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "imageUrl" TEXT,
    "optionA" TEXT NOT NULL,
    "optionB" TEXT NOT NULL,
    "optionC" TEXT NOT NULL,
    "optionD" TEXT NOT NULL,
    "optionE" TEXT,
    "optionF" TEXT,
    "optionG" TEXT,
    "optionH" TEXT,
    "correctIndexes" TEXT,
    "points" INTEGER NOT NULL,
    "phase" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);
INSERT INTO "new_Question" ("championship", "createdAt", "deletedAt", "id", "imageUrl", "optionA", "optionB", "optionC", "optionD", "phase", "points", "text", "updatedAt") SELECT "championship", "createdAt", "deletedAt", "id", "imageUrl", "optionA", "optionB", "optionC", "optionD", "phase", "points", "text", "updatedAt" FROM "Question";
DROP TABLE "Question";
ALTER TABLE "new_Question" RENAME TO "Question";
CREATE TABLE "new_TiebreakQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "championship" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "imageUrl" TEXT,
    "optionA" TEXT NOT NULL,
    "optionB" TEXT NOT NULL,
    "optionC" TEXT NOT NULL,
    "optionD" TEXT NOT NULL,
    "optionE" TEXT,
    "optionF" TEXT,
    "optionG" TEXT,
    "optionH" TEXT,
    "correctIndexes" TEXT,
    "points" INTEGER NOT NULL,
    "phase" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);
INSERT INTO "new_TiebreakQuestion" ("championship", "createdAt", "deletedAt", "id", "imageUrl", "optionA", "optionB", "optionC", "optionD", "phase", "points", "text", "updatedAt") SELECT "championship", "createdAt", "deletedAt", "id", "imageUrl", "optionA", "optionB", "optionC", "optionD", "phase", "points", "text", "updatedAt" FROM "TiebreakQuestion";
DROP TABLE "TiebreakQuestion";
ALTER TABLE "new_TiebreakQuestion" RENAME TO "TiebreakQuestion";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
