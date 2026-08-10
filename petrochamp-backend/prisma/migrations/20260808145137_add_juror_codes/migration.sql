-- CreateTable
CREATE TABLE "Juror" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PhaseJurorAuthorization" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "phaseId" INTEGER NOT NULL,
    "jurorId" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Juror_code_key" ON "Juror"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PhaseJurorAuthorization_phaseId_jurorId_key" ON "PhaseJurorAuthorization"("phaseId", "jurorId");
