-- CreateTable
CREATE TABLE "SocketIOAttachment" (
    "id" BIGSERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" BYTEA NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "SocketIOAttachment_id_key" ON "SocketIOAttachment"("id");
