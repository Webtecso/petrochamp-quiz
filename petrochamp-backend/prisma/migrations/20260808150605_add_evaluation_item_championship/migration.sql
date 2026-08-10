/*
  Warnings:

  - Added the required column `championship` to the `EvaluationItem` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EvaluationItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "championship" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "maxPoints" INTEGER NOT NULL,
    "phase" INTEGER NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'single',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_EvaluationItem" ("createdAt", "id", "maxPoints", "phase", "scope", "text", "type") SELECT "createdAt", "id", "maxPoints", "phase", "scope", "text", "type" FROM "EvaluationItem";
DROP TABLE "EvaluationItem";
ALTER TABLE "new_EvaluationItem" RENAME TO "EvaluationItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
