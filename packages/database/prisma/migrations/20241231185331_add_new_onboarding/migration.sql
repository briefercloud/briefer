-- CreateEnum
CREATE TYPE "OnboardingTutorialStep" AS ENUM ('connectDataSource', 'runQuery', 'runPython', 'createVisualization', 'publishDashboard', 'inviteTeamMembers');

-- CreateTable
CREATE TABLE "OnboardingTutorial" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspaceId" UUID NOT NULL,
    "currentStep" "OnboardingTutorialStep" NOT NULL DEFAULT 'connectDataSource',
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingTutorial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingTutorial_workspaceId_key" ON "OnboardingTutorial"("workspaceId");
