/*
  Warnings:

  - A unique constraint covering the columns `[dataSourceSchemaId]` on the table `DatabricksSQLDataSource` will be added. If there are existing duplicate values, this will fail.
  - Made the column `schema` on table `DatabricksSQLDataSource` required. This step will fail if there are existing NULL values in that column.
  - Made the column `notes` on table `DatabricksSQLDataSource` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "DatabricksSQLDataSource" ADD COLUMN     "dataSourceSchemaId" UUID,
ALTER COLUMN "catalog" SET DEFAULT '',
ALTER COLUMN "schema" SET NOT NULL,
ALTER COLUMN "schema" SET DEFAULT '',
ALTER COLUMN "notes" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "DatabricksSQLDataSource_dataSourceSchemaId_key" ON "DatabricksSQLDataSource"("dataSourceSchemaId");

-- AddForeignKey
ALTER TABLE "DatabricksSQLDataSource" ADD CONSTRAINT "DatabricksSQLDataSource_dataSourceSchemaId_fkey" FOREIGN KEY ("dataSourceSchemaId") REFERENCES "DataSourceSchema"("id") ON DELETE SET NULL ON UPDATE CASCADE;
