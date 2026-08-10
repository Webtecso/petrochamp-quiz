/*
  Warnings:

  - You are about to drop the `BracketMatch` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SuspensePhrase` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `avoidRepeatQuestions` on the `Phase` table. All the data in the column will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "BracketMatch";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "SuspensePhrase";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Phase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "order" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "useQuestions" BOOLEAN NOT NULL DEFAULT true,
    "useJudges" BOOLEAN NOT NULL DEFAULT false,
    "maxQuestions" INTEGER,
    "questionsPerTeam" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Phase" ("createdAt", "id", "label", "maxQuestions", "order", "questionsPerTeam", "useJudges", "useQuestions") SELECT "createdAt", "id", "label", "maxQuestions", "order", "questionsPerTeam", "useJudges", "useQuestions" FROM "Phase";
DROP TABLE "Phase";
ALTER TABLE "new_Phase" RENAME TO "Phase";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
