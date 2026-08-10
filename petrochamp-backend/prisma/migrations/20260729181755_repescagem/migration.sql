-- CreateTable
CREATE TABLE "RepescagemConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "championship" TEXT NOT NULL,
    "phase" INTEGER NOT NULL,
    "maxRepescados" INTEGER NOT NULL,
    "votingOpen" BOOLEAN NOT NULL DEFAULT true,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RepescagemVote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "configId" INTEGER NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
