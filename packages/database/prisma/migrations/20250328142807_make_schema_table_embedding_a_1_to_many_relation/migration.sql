-- CreateTable
CREATE TABLE "DataSourceSchemaTableEmbeddings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "embedding" vector NOT NULL,
    "embeddingModel" TEXT NOT NULL,
    "dataSourceSchemaTableId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataSourceSchemaTableEmbeddings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DataSourceSchemaTableEmbeddings" ADD CONSTRAINT "DataSourceSchemaTableEmbeddings_dataSourceSchemaTableId_fkey" FOREIGN KEY ("dataSourceSchemaTableId") REFERENCES "DataSourceSchemaTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Populate the new table with existing data
INSERT INTO "DataSourceSchemaTableEmbeddings" ("id", "embedding", "embeddingModel", "dataSourceSchemaTableId", "createdAt", "updatedAt")
SELECT 
    gen_random_uuid(),
    "embedding",
    "embeddingModel",
    "id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "DataSourceSchemaTable"
WHERE "embedding" IS NOT NULL AND "embeddingModel" IS NOT NULL;
