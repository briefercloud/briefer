-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastVisitedWorkspaceId" UUID;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_lastVisitedWorkspaceId_fkey" FOREIGN KEY ("lastVisitedWorkspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
