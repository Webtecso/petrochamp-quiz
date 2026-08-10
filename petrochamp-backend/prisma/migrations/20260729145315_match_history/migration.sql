-- CreateTable
CREATE TABLE "MatchHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
