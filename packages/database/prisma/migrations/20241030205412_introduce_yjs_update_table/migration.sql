-- CreateTable
CREATE TABLE "YjsUpdate" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "update" BYTEA NOT NULL,
    "clock" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "yjsDocumentId" UUID,
    "yjsAppDocumentId" UUID,
    "userYjsAppDocumentYjsAppDocumentId" UUID,
    "userYjsAppDocumentUserId" UUID,

    CONSTRAINT "YjsUpdate_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "YjsUpdate" ADD CONSTRAINT "YjsUpdate_yjsDocumentId_fkey" FOREIGN KEY ("yjsDocumentId") REFERENCES "YjsDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YjsUpdate" ADD CONSTRAINT "YjsUpdate_yjsAppDocumentId_fkey" FOREIGN KEY ("yjsAppDocumentId") REFERENCES "YjsAppDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YjsUpdate" ADD CONSTRAINT "YjsUpdate_userYjsAppDocumentYjsAppDocumentId_userYjsAppDoc_fkey" FOREIGN KEY ("userYjsAppDocumentYjsAppDocumentId", "userYjsAppDocumentUserId") REFERENCES "UserYjsAppDocument"("yjsAppDocumentId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
