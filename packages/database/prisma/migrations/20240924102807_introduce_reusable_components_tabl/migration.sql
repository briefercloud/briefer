-- CreateEnum
CREATE TYPE "ReusableComponentType" AS ENUM ('sql', 'python');

-- CreateTable
CREATE TABLE "ReusableComponent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "state" BYTEA NOT NULL,
    "type" "ReusableComponentType" NOT NULL,
    "title" TEXT NOT NULL,
    "blockId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReusableComponent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReusableComponent_blockId_key" ON "ReusableComponent"("blockId");

-- AddForeignKey
ALTER TABLE "ReusableComponent" ADD CONSTRAINT "ReusableComponent_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
