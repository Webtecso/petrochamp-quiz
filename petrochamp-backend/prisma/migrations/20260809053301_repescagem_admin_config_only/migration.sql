-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RepescagemConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "championship" TEXT NOT NULL,
    "phase" INTEGER NOT NULL,
    "maxRepescados" INTEGER NOT NULL,
    "votingDurationSeconds" INTEGER NOT NULL DEFAULT 60,
    "votingOpen" BOOLEAN NOT NULL DEFAULT false,
    "started" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" DATETIME,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_RepescagemConfig" ("championship", "closedAt", "createdAt", "id", "maxRepescados", "phase", "votingOpen") SELECT "championship", "closedAt", "createdAt", "id", "maxRepescados", "phase", "votingOpen" FROM "RepescagemConfig";
DROP TABLE "RepescagemConfig";
ALTER TABLE "new_RepescagemConfig" RENAME TO "RepescagemConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
