/*
  Warnings:

  - The primary key for the `BracketMatch` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `ChampionshipHistory` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `EvaluationItemJuror` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `LiveSession` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `MatchHistory` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `ModeratorAreaPermission` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Partner` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Phase` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `PhaseJurorAuthorization` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `PresentationCriteria` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `PresentationDocument` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `PresentationDupla` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `PresentationScore` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `PresentationSlide` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Question` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `RepescagemConfig` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `RepescagemVote` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `SuspensePhrase` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `TiebreakMatch` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `TiebreakQuestion` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Added the required column `updatedAt` to the `BracketMatch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `ChampionshipHistory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `EvaluationItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `EvaluationItemJuror` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Juror` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `LiveSession` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `MatchHistory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Moderator` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `ModeratorAreaPermission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Partner` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Phase` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `PhaseJurorAuthorization` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `PresentationCriteria` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `PresentationDocument` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `PresentationDupla` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `PresentationScore` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `PresentationSlide` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Question` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `RepescagemConfig` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `RepescagemVote` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Setting` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `SuspensePhrase` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Team` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `TiebreakMatch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `TiebreakQuestion` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "SyncMeta" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "lastSyncedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EvaluationCriteria" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "maxPoints" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "EvaluationCriteria_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "EvaluationItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EvaluationCriteriaScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "criteriaId" TEXT NOT NULL,
    "jurorId" TEXT NOT NULL,
    "team" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "EvaluationCriteriaScore_criteriaId_fkey" FOREIGN KEY ("criteriaId") REFERENCES "EvaluationCriteria" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EvaluationCriteriaScore_jurorId_fkey" FOREIGN KEY ("jurorId") REFERENCES "Juror" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BracketMatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "championship" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "slot" INTEGER NOT NULL,
    "groupName" TEXT,
    "teamAId" TEXT,
    "teamBId" TEXT,
    "winnerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);
INSERT INTO "new_BracketMatch" ("championship", "createdAt", "groupName", "id", "round", "slot", "teamAId", "teamBId", "winnerId") SELECT "championship", "createdAt", "groupName", "id", "round", "slot", "teamAId", "teamBId", "winnerId" FROM "BracketMatch";
DROP TABLE "BracketMatch";
ALTER TABLE "new_BracketMatch" RENAME TO "BracketMatch";
CREATE TABLE "new_ChampionshipHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "championship" TEXT NOT NULL,
    "editionName" TEXT NOT NULL,
    "championTeamId" TEXT,
    "championTeamName" TEXT,
    "finalRankingJson" TEXT NOT NULL,
    "matchesJson" TEXT NOT NULL,
    "totalMatches" INTEGER NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);
INSERT INTO "new_ChampionshipHistory" ("championTeamId", "championTeamName", "championship", "createdAt", "editionName", "endedAt", "finalRankingJson", "id", "matchesJson", "startedAt", "totalMatches") SELECT "championTeamId", "championTeamName", "championship", "createdAt", "editionName", "endedAt", "finalRankingJson", "id", "matchesJson", "startedAt", "totalMatches" FROM "ChampionshipHistory";
DROP TABLE "ChampionshipHistory";
ALTER TABLE "new_ChampionshipHistory" RENAME TO "ChampionshipHistory";
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);
INSERT INTO "new_EvaluationItem" ("championship", "correctIndex", "createdAt", "id", "imageUrl", "maxPoints", "mode", "optionA", "optionB", "optionC", "optionD", "phase", "scope", "text", "timeSeconds", "type") SELECT "championship", "correctIndex", "createdAt", "id", "imageUrl", "maxPoints", "mode", "optionA", "optionB", "optionC", "optionD", "phase", "scope", "text", "timeSeconds", "type" FROM "EvaluationItem";
DROP TABLE "EvaluationItem";
ALTER TABLE "new_EvaluationItem" RENAME TO "EvaluationItem";
CREATE TABLE "new_EvaluationItemJuror" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "jurorId" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "EvaluationItemJuror_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "EvaluationItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EvaluationItemJuror" ("id", "itemId", "jurorId") SELECT "id", "itemId", "jurorId" FROM "EvaluationItemJuror";
DROP TABLE "EvaluationItemJuror";
ALTER TABLE "new_EvaluationItemJuror" RENAME TO "EvaluationItemJuror";
CREATE UNIQUE INDEX "EvaluationItemJuror_itemId_jurorId_key" ON "EvaluationItemJuror"("itemId", "jurorId");
CREATE TABLE "new_Juror" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);
INSERT INTO "new_Juror" ("code", "createdAt", "id", "name") SELECT "code", "createdAt", "id", "name" FROM "Juror";
DROP TABLE "Juror";
ALTER TABLE "new_Juror" RENAME TO "Juror";
CREATE UNIQUE INDEX "Juror_code_key" ON "Juror"("code");
CREATE TABLE "new_LiveSession" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "data" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_LiveSession" ("data", "id") SELECT "data", "id" FROM "LiveSession";
DROP TABLE "LiveSession";
ALTER TABLE "new_LiveSession" RENAME TO "LiveSession";
CREATE TABLE "new_MatchHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "championship" TEXT NOT NULL,
    "editionName" TEXT,
    "phase" INTEGER NOT NULL,
    "phaseLabel" TEXT NOT NULL,
    "teamAId" TEXT NOT NULL,
    "teamAName" TEXT NOT NULL,
    "teamBId" TEXT NOT NULL,
    "teamBName" TEXT NOT NULL,
    "teamAScore" INTEGER NOT NULL,
    "teamBScore" INTEGER NOT NULL,
    "winnerId" TEXT,
    "winnerName" TEXT,
    "wasTiebreak" BOOLEAN NOT NULL DEFAULT false,
    "deviceMode" TEXT,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);
INSERT INTO "new_MatchHistory" ("championship", "createdAt", "deviceMode", "durationSeconds", "editionName", "endedAt", "id", "phase", "phaseLabel", "startedAt", "teamAId", "teamAName", "teamAScore", "teamBId", "teamBName", "teamBScore", "wasTiebreak", "winnerId", "winnerName") SELECT "championship", "createdAt", "deviceMode", "durationSeconds", "editionName", "endedAt", "id", "phase", "phaseLabel", "startedAt", "teamAId", "teamAName", "teamAScore", "teamBId", "teamBName", "teamBScore", "wasTiebreak", "winnerId", "winnerName" FROM "MatchHistory";
DROP TABLE "MatchHistory";
ALTER TABLE "new_MatchHistory" RENAME TO "MatchHistory";
CREATE TABLE "new_Moderator" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'secundario',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);
INSERT INTO "new_Moderator" ("code", "createdAt", "id", "name", "role") SELECT "code", "createdAt", "id", "name", "role" FROM "Moderator";
DROP TABLE "Moderator";
ALTER TABLE "new_Moderator" RENAME TO "Moderator";
CREATE UNIQUE INDEX "Moderator_code_key" ON "Moderator"("code");
CREATE TABLE "new_ModeratorAreaPermission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "moderatorId" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "ModeratorAreaPermission_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "Moderator" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ModeratorAreaPermission" ("area", "id", "moderatorId") SELECT "area", "id", "moderatorId" FROM "ModeratorAreaPermission";
DROP TABLE "ModeratorAreaPermission";
ALTER TABLE "new_ModeratorAreaPermission" RENAME TO "ModeratorAreaPermission";
CREATE UNIQUE INDEX "ModeratorAreaPermission_moderatorId_area_key" ON "ModeratorAreaPermission"("moderatorId", "area");
CREATE TABLE "new_Partner" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);
INSERT INTO "new_Partner" ("createdAt", "id", "logoUrl", "name", "order") SELECT "createdAt", "id", "logoUrl", "name", "order" FROM "Partner";
DROP TABLE "Partner";
ALTER TABLE "new_Partner" RENAME TO "Partner";
CREATE TABLE "new_Phase" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);
INSERT INTO "new_Phase" ("avoidRepeatQuestions", "championship", "createdAt", "id", "initialScoreMaxPoints", "label", "maxQuestions", "order", "presentationMinutes", "presentationWeight", "questionsPerTeam", "quizWeight", "type", "useInitialScores", "useJudges", "useQuestions") SELECT "avoidRepeatQuestions", "championship", "createdAt", "id", "initialScoreMaxPoints", "label", "maxQuestions", "order", "presentationMinutes", "presentationWeight", "questionsPerTeam", "quizWeight", "type", "useInitialScores", "useJudges", "useQuestions" FROM "Phase";
DROP TABLE "Phase";
ALTER TABLE "new_Phase" RENAME TO "Phase";
CREATE TABLE "new_PhaseJurorAuthorization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phaseId" TEXT NOT NULL,
    "jurorId" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "PhaseJurorAuthorization_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "Phase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PhaseJurorAuthorization_jurorId_fkey" FOREIGN KEY ("jurorId") REFERENCES "Juror" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PhaseJurorAuthorization" ("id", "jurorId", "phaseId") SELECT "id", "jurorId", "phaseId" FROM "PhaseJurorAuthorization";
DROP TABLE "PhaseJurorAuthorization";
ALTER TABLE "new_PhaseJurorAuthorization" RENAME TO "PhaseJurorAuthorization";
CREATE UNIQUE INDEX "PhaseJurorAuthorization_phaseId_jurorId_key" ON "PhaseJurorAuthorization"("phaseId", "jurorId");
CREATE TABLE "new_PresentationCriteria" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phaseId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "maxPoints" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "PresentationCriteria_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "Phase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PresentationCriteria" ("createdAt", "id", "label", "maxPoints", "phaseId") SELECT "createdAt", "id", "label", "maxPoints", "phaseId" FROM "PresentationCriteria";
DROP TABLE "PresentationCriteria";
ALTER TABLE "new_PresentationCriteria" RENAME TO "PresentationCriteria";
CREATE TABLE "new_PresentationDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phaseId" TEXT NOT NULL,
    "duplaId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);
INSERT INTO "new_PresentationDocument" ("createdAt", "duplaId", "id", "phaseId", "teamId") SELECT "createdAt", "duplaId", "id", "phaseId", "teamId" FROM "PresentationDocument";
DROP TABLE "PresentationDocument";
ALTER TABLE "new_PresentationDocument" RENAME TO "PresentationDocument";
CREATE UNIQUE INDEX "PresentationDocument_duplaId_teamId_key" ON "PresentationDocument"("duplaId", "teamId");
CREATE TABLE "new_PresentationDupla" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phaseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "themeA" TEXT NOT NULL,
    "themeB" TEXT,
    "teamAId" TEXT NOT NULL,
    "teamBId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "PresentationDupla_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "Phase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PresentationDupla_teamAId_fkey" FOREIGN KEY ("teamAId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PresentationDupla_teamBId_fkey" FOREIGN KEY ("teamBId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PresentationDupla" ("createdAt", "id", "order", "phaseId", "teamAId", "teamBId", "themeA", "themeB") SELECT "createdAt", "id", "order", "phaseId", "teamAId", "teamBId", "themeA", "themeB" FROM "PresentationDupla";
DROP TABLE "PresentationDupla";
ALTER TABLE "new_PresentationDupla" RENAME TO "PresentationDupla";
CREATE TABLE "new_PresentationScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "criteriaId" TEXT NOT NULL,
    "jurorId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "PresentationScore_criteriaId_fkey" FOREIGN KEY ("criteriaId") REFERENCES "PresentationCriteria" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PresentationScore_jurorId_fkey" FOREIGN KEY ("jurorId") REFERENCES "Juror" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PresentationScore_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PresentationScore" ("createdAt", "criteriaId", "id", "jurorId", "score", "teamId") SELECT "createdAt", "criteriaId", "id", "jurorId", "score", "teamId" FROM "PresentationScore";
DROP TABLE "PresentationScore";
ALTER TABLE "new_PresentationScore" RENAME TO "PresentationScore";
CREATE UNIQUE INDEX "PresentationScore_criteriaId_jurorId_teamId_key" ON "PresentationScore"("criteriaId", "jurorId", "teamId");
CREATE TABLE "new_PresentationSlide" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "PresentationSlide_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "PresentationDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PresentationSlide" ("documentId", "id", "imageUrl", "order") SELECT "documentId", "id", "imageUrl", "order" FROM "PresentationSlide";
DROP TABLE "PresentationSlide";
ALTER TABLE "new_PresentationSlide" RENAME TO "PresentationSlide";
CREATE UNIQUE INDEX "PresentationSlide_documentId_order_key" ON "PresentationSlide"("documentId", "order");
CREATE TABLE "new_Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);
INSERT INTO "new_Question" ("championship", "correctIndex", "createdAt", "id", "imageUrl", "optionA", "optionB", "optionC", "optionD", "phase", "points", "text") SELECT "championship", "correctIndex", "createdAt", "id", "imageUrl", "optionA", "optionB", "optionC", "optionD", "phase", "points", "text" FROM "Question";
DROP TABLE "Question";
ALTER TABLE "new_Question" RENAME TO "Question";
CREATE TABLE "new_RepescagemConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "championship" TEXT NOT NULL,
    "phase" INTEGER NOT NULL,
    "maxRepescados" INTEGER NOT NULL,
    "votingDurationSeconds" INTEGER NOT NULL DEFAULT 60,
    "votingOpen" BOOLEAN NOT NULL DEFAULT false,
    "started" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" DATETIME,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);
INSERT INTO "new_RepescagemConfig" ("championship", "closedAt", "createdAt", "id", "maxRepescados", "phase", "started", "startedAt", "votingDurationSeconds", "votingOpen") SELECT "championship", "closedAt", "createdAt", "id", "maxRepescados", "phase", "started", "startedAt", "votingDurationSeconds", "votingOpen" FROM "RepescagemConfig";
DROP TABLE "RepescagemConfig";
ALTER TABLE "new_RepescagemConfig" RENAME TO "RepescagemConfig";
CREATE TABLE "new_RepescagemVote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "configId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "voterToken" TEXT NOT NULL,
    "voterIp" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);
INSERT INTO "new_RepescagemVote" ("configId", "createdAt", "id", "teamId", "voterIp", "voterToken") SELECT "configId", "createdAt", "id", "teamId", "voterIp", "voterToken" FROM "RepescagemVote";
DROP TABLE "RepescagemVote";
ALTER TABLE "new_RepescagemVote" RENAME TO "RepescagemVote";
CREATE UNIQUE INDEX "RepescagemVote_configId_voterToken_key" ON "RepescagemVote"("configId", "voterToken");
CREATE TABLE "new_Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);
INSERT INTO "new_Setting" ("key", "value") SELECT "key", "value" FROM "Setting";
DROP TABLE "Setting";
ALTER TABLE "new_Setting" RENAME TO "Setting";
CREATE TABLE "new_SuspensePhrase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);
INSERT INTO "new_SuspensePhrase" ("createdAt", "id", "text") SELECT "createdAt", "id", "text" FROM "SuspensePhrase";
DROP TABLE "SuspensePhrase";
ALTER TABLE "new_SuspensePhrase" RENAME TO "SuspensePhrase";
CREATE TABLE "new_Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "logoUrl" TEXT,
    "group" TEXT,
    "bracketPosition" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);
INSERT INTO "new_Team" ("bracketPosition", "category", "createdAt", "group", "id", "institution", "logoUrl", "name") SELECT "bracketPosition", "category", "createdAt", "group", "id", "institution", "logoUrl", "name" FROM "Team";
DROP TABLE "Team";
ALTER TABLE "new_Team" RENAME TO "Team";
CREATE TABLE "new_TiebreakMatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "championship" TEXT NOT NULL,
    "phase" INTEGER NOT NULL,
    "teamAId" TEXT NOT NULL,
    "teamBId" TEXT NOT NULL,
    "teamAScore" INTEGER NOT NULL DEFAULT 0,
    "teamBScore" INTEGER NOT NULL DEFAULT 0,
    "winnerId" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);
INSERT INTO "new_TiebreakMatch" ("championship", "createdAt", "id", "phase", "resolved", "teamAId", "teamAScore", "teamBId", "teamBScore", "winnerId") SELECT "championship", "createdAt", "id", "phase", "resolved", "teamAId", "teamAScore", "teamBId", "teamBScore", "winnerId" FROM "TiebreakMatch";
DROP TABLE "TiebreakMatch";
ALTER TABLE "new_TiebreakMatch" RENAME TO "TiebreakMatch";
CREATE TABLE "new_TiebreakQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);
INSERT INTO "new_TiebreakQuestion" ("championship", "correctIndex", "createdAt", "id", "imageUrl", "optionA", "optionB", "optionC", "optionD", "phase", "points", "text") SELECT "championship", "correctIndex", "createdAt", "id", "imageUrl", "optionA", "optionB", "optionC", "optionD", "phase", "points", "text" FROM "TiebreakQuestion";
DROP TABLE "TiebreakQuestion";
ALTER TABLE "new_TiebreakQuestion" RENAME TO "TiebreakQuestion";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationCriteriaScore_criteriaId_jurorId_team_key" ON "EvaluationCriteriaScore"("criteriaId", "jurorId", "team");
