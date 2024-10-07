-- CreateTable
CREATE TABLE "SnowflakeDataSource" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "warehouse" TEXT NOT NULL,
    "database" TEXT NOT NULL,
    "region" TEXT DEFAULT 'us-west',
    "notes" TEXT NOT NULL,
    "structure" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "connStatus" "ConnStatus" NOT NULL DEFAULT 'online',
    "connError" TEXT,
    "lastConnection" TIMESTAMP(3),
    "workspaceId" UUID NOT NULL,

    CONSTRAINT "SnowflakeDataSource_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SnowflakeDataSource" ADD CONSTRAINT "SnowflakeDataSource_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
