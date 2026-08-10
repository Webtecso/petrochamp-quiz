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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Phase" ("avoidRepeatQuestions", "championship", "createdAt", "id", "label", "maxQuestions", "order", "questionsPerTeam", "useJudges", "useQuestions") SELECT "avoidRepeatQuestions", "championship", "createdAt", "id", "label", "maxQuestions", "order", "questionsPerTeam", "useJudges", "useQuestions" FROM "Phase";
DROP TABLE "Phase";
ALTER TABLE "new_Phase" RENAME TO "Phase";
CREATE TABLE "new_Question" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "championship" TEXT NOT NULL,
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
INSERT INTO "new_Question" ("championship", "correctIndex", "createdAt", "id", "imageUrl", "optionA", "optionB", "optionC", "optionD", "phase", "points", "text") SELECT "championship", "correctIndex", "createdAt", "id", "imageUrl", "optionA", "optionB", "optionC", "optionD", "phase", "points", "text" FROM "Question";
DROP TABLE "Question";
ALTER TABLE "new_Question" RENAME TO "Question";
CREATE TABLE "new_TiebreakQuestion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "championship" TEXT NOT NULL,
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
INSERT INTO "new_TiebreakQuestion" ("championship", "correctIndex", "createdAt", "id", "imageUrl", "optionA", "optionB", "optionC", "optionD", "phase", "points", "text") SELECT "championship", "correctIndex", "createdAt", "id", "imageUrl", "optionA", "optionB", "optionC", "optionD", "phase", "points", "text" FROM "TiebreakQuestion";
DROP TABLE "TiebreakQuestion";
ALTER TABLE "new_TiebreakQuestion" RENAME TO "TiebreakQuestion";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
