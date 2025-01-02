/*
  Warnings:

  - You are about to drop the column `onboardingStep` on the `Workspace` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Workspace" DROP COLUMN "onboardingStep";

-- DropEnum
DROP TYPE "OnboardingStep";
