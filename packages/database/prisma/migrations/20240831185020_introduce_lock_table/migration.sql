/*
  Warnings:

  - Added the required column `ownerId` to the `Lock` table without a default value. This is not possible if the table is not empty.
  - Made the column `expiresAt` on table `Lock` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Lock" ADD COLUMN     "ownerId" UUID NOT NULL,
ALTER COLUMN "expiresAt" SET NOT NULL;
