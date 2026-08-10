-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EvaluationItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "maxPoints" INTEGER NOT NULL,
    "phase" INTEGER NOT NULL,
    "sharedAcrossTeams" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_EvaluationItem" ("createdAt", "id", "maxPoints", "phase", "text", "type") SELECT "createdAt", "id", "maxPoints", "phase", "text", "type" FROM "EvaluationItem";
DROP TABLE "EvaluationItem";
ALTER TABLE "new_EvaluationItem" RENAME TO "EvaluationItem";
CREATE TABLE "new_Phase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "order" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "useQuestions" BOOLEAN NOT NULL DEFAULT true,
    "useJudges" BOOLEAN NOT NULL DEFAULT false,
    "questionsPerTeam" INTEGER NOT NULL DEFAULT 5,
    "repeatQuestionsWhenExhausted" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Phase" ("createdAt", "id", "label", "order", "useJudges", "useQuestions") SELECT "createdAt", "id", "label", "order", "useJudges", "useQuestions" FROM "Phase";
DROP TABLE "Phase";
ALTER TABLE "new_Phase" RENAME TO "Phase";
CREATE TABLE "new_Question" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "text" TEXT NOT NULL,
    "imageUrl" TEXT,
    "optionA" TEXT NOT NULL,
    "optionB" TEXT NOT NULL,
    "optionC" TEXT NOT NULL,
    "optionD" TEXT NOT NULL,
    "correctIndex" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "phase" INTEGER NOT NULL,
    "isTiebreaker" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Question" ("correctIndex", "createdAt", "id", "imageUrl", "optionA", "optionB", "optionC", "optionD", "phase", "points", "text") SELECT "correctIndex", "createdAt", "id", "imageUrl", "optionA", "optionB", "optionC", "optionD", "phase", "points", "text" FROM "Question";
DROP TABLE "Question";
ALTER TABLE "new_Question" RENAME TO "Question";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
