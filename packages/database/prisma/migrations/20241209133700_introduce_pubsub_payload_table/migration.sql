-- CreateTable
CREATE TABLE "PubSubPayload" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payload" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PubSubPayload_pkey" PRIMARY KEY ("id")
);
