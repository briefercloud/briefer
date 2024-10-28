-- AlterTable
ALTER TABLE "DataSourceSchema" ADD COLUMN     "error" JSONB,
ADD COLUMN     "failedAt" TIMESTAMP(3);
