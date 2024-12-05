-- AlterTable
ALTER TABLE "ReusableComponent" ADD COLUMN     "instancesCreated" BOOLEAN NOT NULL DEFAULT true;
-- default is true but existing ones should be false
UPDATE "ReusableComponent" SET "instancesCreated" = false;

-- CreateTable
CREATE TABLE "ReusableComponentInstance" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "blockId" UUID NOT NULL,
    "reusableComponentId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReusableComponentInstance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReusableComponentInstance_blockId_key" ON "ReusableComponentInstance"("blockId");

-- AddForeignKey
ALTER TABLE "ReusableComponentInstance" ADD CONSTRAINT "ReusableComponentInstance_reusableComponentId_fkey" FOREIGN KEY ("reusableComponentId") REFERENCES "ReusableComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReusableComponentInstance" ADD CONSTRAINT "ReusableComponentInstance_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
