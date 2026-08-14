/*
  Warnings:

  - Added the required column `voterToken` to the `RepescagemVote` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RepescagemVote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "configId" INTEGER NOT NULL,
    "teamId" TEXT NOT NULL,
    "voterToken" TEXT NOT NULL,
    "voterIp" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_RepescagemVote" ("configId", "createdAt", "id", "teamId") SELECT "configId", "createdAt", "id", "teamId" FROM "RepescagemVote";
DROP TABLE "RepescagemVote";
ALTER TABLE "new_RepescagemVote" RENAME TO "RepescagemVote";
CREATE UNIQUE INDEX "RepescagemVote_configId_voterToken_key" ON "RepescagemVote"("configId", "voterToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
