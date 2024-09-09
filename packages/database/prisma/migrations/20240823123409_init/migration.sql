-- CreateEnum
CREATE TYPE "DataSourceType" AS ENUM ('psql', 'redshift', 'bigquery');

-- CreateEnum
CREATE TYPE "ConnStatus" AS ENUM ('online', 'offline', 'checking');

-- CreateEnum
CREATE TYPE "ExecutionScheduleType" AS ENUM ('hourly', 'daily', 'weekly', 'monthly', 'cron');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('free', 'trial', 'professional');

-- CreateEnum
CREATE TYPE "OnboardingStep" AS ENUM ('intro', 'connectDataSource', 'activateTrial', 'joinSlack', 'done');

-- CreateEnum
CREATE TYPE "UserWorkspaceRole" AS ENUM ('editor', 'viewer', 'admin');

-- CreateEnum
CREATE TYPE "EnvironmentStatus" AS ENUM ('Running', 'Stopped', 'Failing', 'Starting', 'Stopping');

-- CreateTable
CREATE TABLE "Document" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'DocumentIcon',
    "orderIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "isSyncedWithYjs" BOOLEAN NOT NULL DEFAULT false,
    "workspaceId" UUID NOT NULL,
    "parentId" UUID,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YjsDocument" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clock" INTEGER NOT NULL DEFAULT 0,
    "state" BYTEA NOT NULL,
    "documentId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YjsDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YjsAppDocument" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clock" INTEGER NOT NULL DEFAULT 0,
    "state" BYTEA NOT NULL,
    "documentId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YjsAppDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserYjsAppDocument" (
    "clock" INTEGER NOT NULL DEFAULT 0,
    "state" BYTEA NOT NULL,
    "yjsAppDocumentId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "userChangedState" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserYjsAppDocument_pkey" PRIMARY KEY ("yjsAppDocumentId","userId")
);

-- CreateTable
CREATE TABLE "QueryExecution" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "documentId" UUID NOT NULL,
    "blockId" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "dataSourceId" UUID NOT NULL,
    "dataSourceType" "DataSourceType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QueryExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueryResult" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "documentId" UUID NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "columns" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QueryResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueryResultRow" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "queryResultId" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "row" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QueryResultRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostgreSQLDataSource" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" TEXT NOT NULL,
    "database" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "readOnly" BOOLEAN NOT NULL DEFAULT true,
    "cert" TEXT,
    "structure" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "connStatus" "ConnStatus" NOT NULL DEFAULT 'online',
    "connError" TEXT,
    "lastConnection" TIMESTAMP(3),
    "workspaceId" UUID NOT NULL,

    CONSTRAINT "PostgreSQLDataSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MySQLDataSource" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" TEXT NOT NULL,
    "database" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "cert" TEXT,
    "notes" TEXT NOT NULL,
    "structure" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "connStatus" "ConnStatus" NOT NULL DEFAULT 'online',
    "connError" TEXT,
    "lastConnection" TIMESTAMP(3),
    "workspaceId" UUID NOT NULL,

    CONSTRAINT "MySQLDataSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OracleDataSource" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" TEXT NOT NULL,
    "database" TEXT NOT NULL DEFAULT '',
    "serviceName" TEXT NOT NULL DEFAULT '',
    "sid" TEXT NOT NULL DEFAULT '',
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "structure" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "connStatus" "ConnStatus" NOT NULL DEFAULT 'online',
    "connError" TEXT,
    "lastConnection" TIMESTAMP(3),
    "workspaceId" UUID NOT NULL,

    CONSTRAINT "OracleDataSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AthenaDataSource" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "accessKeyId" TEXT NOT NULL,
    "secretAccessKeyId" TEXT NOT NULL,
    "s3OutputPath" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "structure" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "connStatus" "ConnStatus" NOT NULL DEFAULT 'online',
    "connError" TEXT,
    "lastConnection" TIMESTAMP(3),
    "workspaceId" UUID NOT NULL,

    CONSTRAINT "AthenaDataSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BigQueryDataSource" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "serviceAccountKey" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "structure" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "connStatus" "ConnStatus" NOT NULL DEFAULT 'online',
    "connError" TEXT,
    "lastConnection" TIMESTAMP(3),
    "workspaceId" UUID NOT NULL,

    CONSTRAINT "BigQueryDataSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RedshiftDataSource" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" TEXT NOT NULL,
    "database" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "cert" TEXT,
    "structure" TEXT,
    "readOnly" BOOLEAN NOT NULL DEFAULT true,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "connStatus" "ConnStatus" NOT NULL DEFAULT 'online',
    "connError" TEXT,
    "lastConnection" TIMESTAMP(3),
    "workspaceId" UUID NOT NULL,

    CONSTRAINT "RedshiftDataSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL,
    "picture" TEXT,
    "passwordDigest" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "content" TEXT NOT NULL,
    "documentId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "documentId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionSchedule" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "ExecutionScheduleType" NOT NULL,
    "hour" INTEGER,
    "minute" INTEGER,
    "cron" TEXT,
    "weekdays" TEXT,
    "days" TEXT,
    "timezone" TEXT NOT NULL,
    "documentId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutionSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "source" TEXT,
    "useCases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "useContext" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'free',
    "ownerId" UUID NOT NULL,
    "onboardingStep" "OnboardingStep" NOT NULL DEFAULT 'intro',
    "assistantModel" TEXT NOT NULL DEFAULT 'gpt-4o',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserWorkspace" (
    "userId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "inviterId" UUID,
    "role" "UserWorkspaceRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserWorkspace_pkey" PRIMARY KEY ("userId","workspaceId")
);

-- CreateTable
CREATE TABLE "EnvironmentVariable" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" UUID NOT NULL,

    CONSTRAINT "EnvironmentVariable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Environment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspaceId" UUID NOT NULL,
    "status" "EnvironmentStatus" NOT NULL,
    "startedAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3),
    "resourceVersion" INTEGER NOT NULL,
    "jupyterToken" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Environment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "YjsDocument_documentId_key" ON "YjsDocument"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "documentId_index" ON "Favorite"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_documentId_key" ON "Favorite"("userId", "documentId");

-- CreateIndex
CREATE UNIQUE INDEX "unique_workspaceId_name" ON "EnvironmentVariable"("workspaceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Environment_workspaceId_key" ON "Environment"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "unique_workspaceId" ON "Environment"("workspaceId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YjsDocument" ADD CONSTRAINT "YjsDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YjsAppDocument" ADD CONSTRAINT "YjsAppDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserYjsAppDocument" ADD CONSTRAINT "UserYjsAppDocument_yjsAppDocumentId_fkey" FOREIGN KEY ("yjsAppDocumentId") REFERENCES "YjsAppDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserYjsAppDocument" ADD CONSTRAINT "UserYjsAppDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueryExecution" ADD CONSTRAINT "QueryExecution_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueryResult" ADD CONSTRAINT "QueryResult_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueryResultRow" ADD CONSTRAINT "QueryResultRow_queryResultId_fkey" FOREIGN KEY ("queryResultId") REFERENCES "QueryResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostgreSQLDataSource" ADD CONSTRAINT "PostgreSQLDataSource_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MySQLDataSource" ADD CONSTRAINT "MySQLDataSource_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OracleDataSource" ADD CONSTRAINT "OracleDataSource_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthenaDataSource" ADD CONSTRAINT "AthenaDataSource_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BigQueryDataSource" ADD CONSTRAINT "BigQueryDataSource_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedshiftDataSource" ADD CONSTRAINT "RedshiftDataSource_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionSchedule" ADD CONSTRAINT "ExecutionSchedule_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWorkspace" ADD CONSTRAINT "UserWorkspace_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWorkspace" ADD CONSTRAINT "UserWorkspace_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWorkspace" ADD CONSTRAINT "UserWorkspace_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentVariable" ADD CONSTRAINT "EnvironmentVariable_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
