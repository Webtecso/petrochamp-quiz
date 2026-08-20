-- CreateTable
CREATE TABLE "ModeratorAreaPermission" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "moderatorId" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    CONSTRAINT "ModeratorAreaPermission_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "Moderator" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ModeratorAreaPermission_moderatorId_area_key" ON "ModeratorAreaPermission"("moderatorId", "area");
