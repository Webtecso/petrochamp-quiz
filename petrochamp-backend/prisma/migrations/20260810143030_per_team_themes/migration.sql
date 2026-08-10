/*
  Warnings:

  - You are about to drop the column `theme` on the `PresentationDupla` table. All the data in the column will be lost.
  - Added the required column `themeA` to the `PresentationDupla` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PresentationDupla" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "phaseId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "themeA" TEXT NOT NULL,
    "themeB" TEXT,
    "teamAId" TEXT NOT NULL,
    "teamBId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_PresentationDupla" ("createdAt", "id", "order", "phaseId", "teamAId", "teamBId", "themeA")
SELECT "createdAt", "id", "order", "phaseId", "teamAId", "teamBId", "theme" FROM "PresentationDupla";
DROP TABLE "PresentationDupla";
ALTER TABLE "new_PresentationDupla" RENAME TO "PresentationDupla";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
