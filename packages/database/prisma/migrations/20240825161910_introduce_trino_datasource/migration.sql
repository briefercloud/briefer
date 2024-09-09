-- CreateTable
CREATE TABLE "TrinoDataSource" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" TEXT NOT NULL,
    "catalog" TEXT,
    "username" TEXT NOT NULL,
    "password" TEXT,
    "notes" TEXT NOT NULL,
    "readOnly" BOOLEAN NOT NULL DEFAULT true,
    "structure" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "connStatus" "ConnStatus" NOT NULL DEFAULT 'online',
    "connError" TEXT,
    "lastConnection" TIMESTAMP(3),
    "workspaceId" UUID NOT NULL,

    CONSTRAINT "TrinoDataSource_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TrinoDataSource" ADD CONSTRAINT "TrinoDataSource_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
