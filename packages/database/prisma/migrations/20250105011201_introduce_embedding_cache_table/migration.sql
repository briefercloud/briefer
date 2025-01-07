-- CreateTable
CREATE TABLE "EmbeddingCache" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "inputChecksum" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "embedding" vector NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmbeddingCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unique_inputChecksum_model" ON "EmbeddingCache"("inputChecksum", "model");
