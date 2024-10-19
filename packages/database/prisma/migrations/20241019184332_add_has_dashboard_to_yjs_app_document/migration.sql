/*
  Warnings:

  - Added the required column `hasDashboard` to the `YjsAppDocument` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "YjsAppDocument" ADD COLUMN     "hasDashboard" BOOLEAN;

-- Fill the new column with the default value
UPDATE "YjsAppDocument" SET "hasDashboard" = false;

-- Set the new column to be non-nullable
ALTER TABLE "YjsAppDocument" ALTER COLUMN "hasDashboard" SET NOT NULL;
