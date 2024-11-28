/*
  Warnings:

  - You are about to drop the `SocketIOAttachment` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "SocketIOAttachment";

-- CreateTable
CREATE TABLE "socket_io_attachments" (
    "id" BIGSERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" BYTEA NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "socket_io_attachments_id_key" ON "socket_io_attachments"("id");
