-- CreateTable
CREATE TABLE "PresentationDupla" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "phaseId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "theme" TEXT NOT NULL,
    "teamAId" TEXT NOT NULL,
    "teamBId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PresentationCriteria" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "phaseId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "maxPoints" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PresentationScore" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "criteriaId" INTEGER NOT NULL,
    "jurorId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Phase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "championship" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'quiz',
    "useQuestions" BOOLEAN NOT NULL DEFAULT true,
    "useJudges" BOOLEAN NOT NULL DEFAULT false,
    "maxQuestions" INTEGER,
    "questionsPerTeam" INTEGER,
    "avoidRepeatQuestions" BOOLEAN NOT NULL DEFAULT true,
    "useInitialScores" BOOLEAN NOT NULL DEFAULT false,
    "initialScoreMaxPoints" INTEGER,
    "presentationMinutes" INTEGER,
    "presentationWeight" INTEGER DEFAULT 50,
    "quizWeight" INTEGER DEFAULT 50,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Phase" ("avoidRepeatQuestions", "championship", "createdAt", "id", "initialScoreMaxPoints", "label", "maxQuestions", "order", "questionsPerTeam", "useInitialScores", "useJudges", "useQuestions") SELECT "avoidRepeatQuestions", "championship", "createdAt", "id", "initialScoreMaxPoints", "label", "maxQuestions", "order", "questionsPerTeam", "useInitialScores", "useJudges", "useQuestions" FROM "Phase";
DROP TABLE "Phase";
ALTER TABLE "new_Phase" RENAME TO "Phase";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "PresentationScore_criteriaId_jurorId_teamId_key" ON "PresentationScore"("criteriaId", "jurorId", "teamId");
