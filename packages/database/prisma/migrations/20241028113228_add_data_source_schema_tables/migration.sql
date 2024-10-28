/*
  Warnings:

  - A unique constraint covering the columns `[dataSourceSchemaId]` on the table `AthenaDataSource` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[dataSourceSchemaId]` on the table `BigQueryDataSource` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[dataSourceSchemaId]` on the table `MySQLDataSource` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[dataSourceSchemaId]` on the table `OracleDataSource` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[dataSourceSchemaId]` on the table `PostgreSQLDataSource` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[dataSourceSchemaId]` on the table `RedshiftDataSource` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[dataSourceSchemaId]` on the table `SQLServerDataSource` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[dataSourceSchemaId]` on the table `SnowflakeDataSource` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[dataSourceSchemaId]` on the table `TrinoDataSource` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "DataSourceSchemaStatus" AS ENUM ('success', 'failed', 'loading');

-- AlterTable
ALTER TABLE "AthenaDataSource" ADD COLUMN     "dataSourceSchemaId" UUID;

-- AlterTable
ALTER TABLE "BigQueryDataSource" ADD COLUMN     "dataSourceSchemaId" UUID;

-- AlterTable
ALTER TABLE "MySQLDataSource" ADD COLUMN     "dataSourceSchemaId" UUID;

-- AlterTable
ALTER TABLE "OracleDataSource" ADD COLUMN     "dataSourceSchemaId" UUID;

-- AlterTable
ALTER TABLE "PostgreSQLDataSource" ADD COLUMN     "dataSourceSchemaId" UUID;

-- AlterTable
ALTER TABLE "RedshiftDataSource" ADD COLUMN     "dataSourceSchemaId" UUID;

-- AlterTable
ALTER TABLE "SQLServerDataSource" ADD COLUMN     "dataSourceSchemaId" UUID;

-- AlterTable
ALTER TABLE "SnowflakeDataSource" ADD COLUMN     "dataSourceSchemaId" UUID;

-- AlterTable
ALTER TABLE "TrinoDataSource" ADD COLUMN     "dataSourceSchemaId" UUID;

-- CreateTable
CREATE TABLE "DataSourceSchema" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "status" "DataSourceSchemaStatus" NOT NULL,
    "refreshPing" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataSourceSchema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataSourceSchemaTable" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "schema" TEXT NOT NULL,
    "columns" JSONB NOT NULL,
    "dataSourceSchemaId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataSourceSchemaTable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unique_dataSourceSchemaId_name" ON "DataSourceSchemaTable"("dataSourceSchemaId", "schema", "name");

-- CreateIndex
CREATE UNIQUE INDEX "AthenaDataSource_dataSourceSchemaId_key" ON "AthenaDataSource"("dataSourceSchemaId");

-- CreateIndex
CREATE UNIQUE INDEX "BigQueryDataSource_dataSourceSchemaId_key" ON "BigQueryDataSource"("dataSourceSchemaId");

-- CreateIndex
CREATE UNIQUE INDEX "MySQLDataSource_dataSourceSchemaId_key" ON "MySQLDataSource"("dataSourceSchemaId");

-- CreateIndex
CREATE UNIQUE INDEX "OracleDataSource_dataSourceSchemaId_key" ON "OracleDataSource"("dataSourceSchemaId");

-- CreateIndex
CREATE UNIQUE INDEX "PostgreSQLDataSource_dataSourceSchemaId_key" ON "PostgreSQLDataSource"("dataSourceSchemaId");

-- CreateIndex
CREATE UNIQUE INDEX "RedshiftDataSource_dataSourceSchemaId_key" ON "RedshiftDataSource"("dataSourceSchemaId");

-- CreateIndex
CREATE UNIQUE INDEX "SQLServerDataSource_dataSourceSchemaId_key" ON "SQLServerDataSource"("dataSourceSchemaId");

-- CreateIndex
CREATE UNIQUE INDEX "SnowflakeDataSource_dataSourceSchemaId_key" ON "SnowflakeDataSource"("dataSourceSchemaId");

-- CreateIndex
CREATE UNIQUE INDEX "TrinoDataSource_dataSourceSchemaId_key" ON "TrinoDataSource"("dataSourceSchemaId");

-- AddForeignKey
ALTER TABLE "PostgreSQLDataSource" ADD CONSTRAINT "PostgreSQLDataSource_dataSourceSchemaId_fkey" FOREIGN KEY ("dataSourceSchemaId") REFERENCES "DataSourceSchema"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MySQLDataSource" ADD CONSTRAINT "MySQLDataSource_dataSourceSchemaId_fkey" FOREIGN KEY ("dataSourceSchemaId") REFERENCES "DataSourceSchema"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SQLServerDataSource" ADD CONSTRAINT "SQLServerDataSource_dataSourceSchemaId_fkey" FOREIGN KEY ("dataSourceSchemaId") REFERENCES "DataSourceSchema"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OracleDataSource" ADD CONSTRAINT "OracleDataSource_dataSourceSchemaId_fkey" FOREIGN KEY ("dataSourceSchemaId") REFERENCES "DataSourceSchema"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthenaDataSource" ADD CONSTRAINT "AthenaDataSource_dataSourceSchemaId_fkey" FOREIGN KEY ("dataSourceSchemaId") REFERENCES "DataSourceSchema"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SnowflakeDataSource" ADD CONSTRAINT "SnowflakeDataSource_dataSourceSchemaId_fkey" FOREIGN KEY ("dataSourceSchemaId") REFERENCES "DataSourceSchema"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BigQueryDataSource" ADD CONSTRAINT "BigQueryDataSource_dataSourceSchemaId_fkey" FOREIGN KEY ("dataSourceSchemaId") REFERENCES "DataSourceSchema"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedshiftDataSource" ADD CONSTRAINT "RedshiftDataSource_dataSourceSchemaId_fkey" FOREIGN KEY ("dataSourceSchemaId") REFERENCES "DataSourceSchema"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrinoDataSource" ADD CONSTRAINT "TrinoDataSource_dataSourceSchemaId_fkey" FOREIGN KEY ("dataSourceSchemaId") REFERENCES "DataSourceSchema"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataSourceSchemaTable" ADD CONSTRAINT "DataSourceSchemaTable_dataSourceSchemaId_fkey" FOREIGN KEY ("dataSourceSchemaId") REFERENCES "DataSourceSchema"("id") ON DELETE CASCADE ON UPDATE CASCADE;
