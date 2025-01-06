/*
  Warnings:

  - You are about to drop the column `onboardingStep` on the `Workspace` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "OnboardingTutorialStep" AS ENUM ('connectDataSource', 'runQuery', 'runPython', 'createVisualization', 'publishDashboard', 'inviteTeamMembers');

-- AlterTable
ALTER TABLE "Workspace" DROP COLUMN "onboardingStep";

-- DropEnum
DROP TYPE "OnboardingStep";

-- CreateTable
CREATE TABLE "OnboardingTutorial" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspaceId" UUID NOT NULL,
    "currentStep" "OnboardingTutorialStep" NOT NULL DEFAULT 'connectDataSource',
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDismissed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OnboardingTutorial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingTutorial_workspaceId_key" ON "OnboardingTutorial"("workspaceId");

-- AddForeignKey
ALTER TABLE "OnboardingTutorial" ADD CONSTRAINT "OnboardingTutorial_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
