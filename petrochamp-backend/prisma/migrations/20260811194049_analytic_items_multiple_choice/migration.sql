-- CreateTable
CREATE TABLE "EvaluationItemJuror" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "itemId" TEXT NOT NULL,
    "jurorId" TEXT NOT NULL,
    CONSTRAINT "EvaluationItemJuror_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "EvaluationItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "correctIndex" INTEGER,
    "timeSeconds" INTEGER,
    "maxPoints" INTEGER NOT NULL,
    "phase" INTEGER NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'single',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_EvaluationItem" ("championship", "createdAt", "id", "maxPoints", "phase", "scope", "text", "type") SELECT "championship", "createdAt", "id", "maxPoints", "phase", "scope", "text", "type" FROM "EvaluationItem";
DROP TABLE "EvaluationItem";
ALTER TABLE "new_EvaluationItem" RENAME TO "EvaluationItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationItemJuror_itemId_jurorId_key" ON "EvaluationItemJuror"("itemId", "jurorId");
