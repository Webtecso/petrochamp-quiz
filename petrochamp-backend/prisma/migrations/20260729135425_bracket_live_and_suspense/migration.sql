-- CreateTable
CREATE TABLE "BracketMatch" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "championship" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "slot" INTEGER NOT NULL,
    "groupName" TEXT,
    "teamAId" TEXT,
    "teamBId" TEXT,
    "winnerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SuspensePhrase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
