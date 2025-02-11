/*
  Warnings:

  - Added the required column `embeddingModel` to the `DataSourceSchemaTable` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable

-- Use text-embedding-3-small as the DEFAULT when creating the COLUMN
ALTER TABLE "DataSourceSchemaTable" ADD COLUMN "embeddingModel" TEXT NOT NULL DEFAULT 'text-embedding-3-small';

-- remove default from the column
ALTER TABLE "DataSourceSchemaTable" ALTER COLUMN "embeddingModel" DROP DEFAULT;
