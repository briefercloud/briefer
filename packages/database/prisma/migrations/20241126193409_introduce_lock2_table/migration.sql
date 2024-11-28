-- CreateTable
CREATE TABLE "Lock2" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Lock2_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lock2_name_key" ON "Lock2"("name");
