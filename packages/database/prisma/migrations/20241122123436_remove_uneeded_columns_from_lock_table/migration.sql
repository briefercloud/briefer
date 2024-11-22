/*
  Warnings:

  - You are about to drop the column `acquiredAt` on the `Lock` table. All the data in the column will be lost.
  - You are about to drop the column `expiresAt` on the `Lock` table. All the data in the column will be lost.
  - You are about to drop the column `isLocked` on the `Lock` table. All the data in the column will be lost.
  - You are about to drop the column `ownerId` on the `Lock` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Lock" DROP COLUMN "acquiredAt",
DROP COLUMN "expiresAt",
DROP COLUMN "isLocked",
DROP COLUMN "ownerId";
