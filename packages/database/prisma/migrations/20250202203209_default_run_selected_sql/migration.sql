-- AlterTable
ALTER TABLE "Document" ALTER COLUMN "runSQLSelection" SET DEFAULT true;

-- Set all existing documents to run SQL selection by default
-- No one turned this off on purpose, so we can safely assume that
-- previous users would have wanted this feature
UPDATE "Document" SET "runSQLSelection" = true;
