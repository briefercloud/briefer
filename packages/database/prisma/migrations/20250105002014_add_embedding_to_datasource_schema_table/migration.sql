CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable
ALTER TABLE "DataSourceSchemaTable" ADD COLUMN     "embedding" vector;
