/*
  Warnings:

  - A unique constraint covering the columns `[secretsId]` on the table `Workspace` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "secretsId" UUID;

-- CreateTable
CREATE TABLE "WorkspaceSecrets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "openAiApiKey" TEXT,

    CONSTRAINT "WorkspaceSecrets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_secretsId_key" ON "Workspace"("secretsId");

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_secretsId_fkey" FOREIGN KEY ("secretsId") REFERENCES "WorkspaceSecrets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
