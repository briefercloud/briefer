-- CreateTable
CREATE TABLE "Lock" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "isLocked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Lock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lock_name_key" ON "Lock"("name");
