-- CreateTable
CREATE TABLE "SQLServerDataSource" (
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

    CONSTRAINT "SQLServerDataSource_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SQLServerDataSource" ADD CONSTRAINT "SQLServerDataSource_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
