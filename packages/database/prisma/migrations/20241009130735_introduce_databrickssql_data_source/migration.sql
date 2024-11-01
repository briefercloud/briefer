-- CreateTable
CREATE TABLE "DatabricksSQLDataSource" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "http_path" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "catalog" TEXT NOT NULL DEFAULT 'main',
    "schema" TEXT,
    "notes" TEXT,
    "structure" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "connStatus" "ConnStatus" NOT NULL DEFAULT 'online',
    "connError" TEXT,
    "lastConnection" TIMESTAMP(3),
    "workspaceId" UUID NOT NULL,

    CONSTRAINT "DatabricksSQLDataSource_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DatabricksSQLDataSource" ADD CONSTRAINT "DatabricksSQLDataSource_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
