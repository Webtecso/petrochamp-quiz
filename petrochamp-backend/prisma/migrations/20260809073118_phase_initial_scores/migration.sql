-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Phase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "championship" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "useQuestions" BOOLEAN NOT NULL DEFAULT true,
    "useJudges" BOOLEAN NOT NULL DEFAULT false,
    "maxQuestions" INTEGER,
    "questionsPerTeam" INTEGER,
    "avoidRepeatQuestions" BOOLEAN NOT NULL DEFAULT true,
    "useInitialScores" BOOLEAN NOT NULL DEFAULT false,
    "initialScoreMaxPoints" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Phase" ("avoidRepeatQuestions", "championship", "createdAt", "id", "label", "maxQuestions", "order", "questionsPerTeam", "useJudges", "useQuestions") SELECT "avoidRepeatQuestions", "championship", "createdAt", "id", "label", "maxQuestions", "order", "questionsPerTeam", "useJudges", "useQuestions" FROM "Phase";
DROP TABLE "Phase";
ALTER TABLE "new_Phase" RENAME TO "Phase";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
