/*
  Warnings:

  - You are about to drop the column `fileName` on the `PresentationDocument` table. All the data in the column will be lost.
  - You are about to drop the column `fileUrl` on the `PresentationDocument` table. All the data in the column will be lost.
  - You are about to drop the column `pageCount` on the `PresentationDocument` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "PresentationSlide" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "documentId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    CONSTRAINT "PresentationSlide_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "PresentationDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PresentationDocument" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "phaseId" INTEGER NOT NULL,
    "duplaId" INTEGER NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_PresentationDocument" ("createdAt", "duplaId", "id", "phaseId", "teamId") SELECT "createdAt", "duplaId", "id", "phaseId", "teamId" FROM "PresentationDocument";
DROP TABLE "PresentationDocument";
ALTER TABLE "new_PresentationDocument" RENAME TO "PresentationDocument";
CREATE UNIQUE INDEX "PresentationDocument_duplaId_teamId_key" ON "PresentationDocument"("duplaId", "teamId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "PresentationSlide_documentId_order_key" ON "PresentationSlide"("documentId", "order");
