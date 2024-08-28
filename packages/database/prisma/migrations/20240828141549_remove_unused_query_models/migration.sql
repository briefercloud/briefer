/*
  Warnings:

  - You are about to drop the `QueryExecution` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `QueryResult` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `QueryResultRow` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "QueryExecution" DROP CONSTRAINT "QueryExecution_documentId_fkey";

-- DropForeignKey
ALTER TABLE "QueryResult" DROP CONSTRAINT "QueryResult_documentId_fkey";

-- DropForeignKey
ALTER TABLE "QueryResultRow" DROP CONSTRAINT "QueryResultRow_queryResultId_fkey";

-- DropTable
DROP TABLE "QueryExecution";

-- DropTable
DROP TABLE "QueryResult";

-- DropTable
DROP TABLE "QueryResultRow";
