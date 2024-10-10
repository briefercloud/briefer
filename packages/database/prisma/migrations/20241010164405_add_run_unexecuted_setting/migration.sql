/*
  Warnings:

  - You are about to drop the column `runUnexecutedblocks` on the `Document` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Document" DROP COLUMN "runUnexecutedblocks",
ADD COLUMN     "runUnexecutedBlocks" BOOLEAN NOT NULL DEFAULT true;
