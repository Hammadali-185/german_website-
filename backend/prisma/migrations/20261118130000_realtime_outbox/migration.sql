CREATE TABLE "RealtimeOutbox" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    CONSTRAINT "RealtimeOutbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RealtimeOutbox_publishedAt_createdAt_idx" ON "RealtimeOutbox"("publishedAt", "createdAt");

CREATE TABLE "RealtimeTicket" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RealtimeTicket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RealtimeTicket_tokenHash_key" ON "RealtimeTicket"("tokenHash");
ALTER TABLE "RealtimeTicket" ADD CONSTRAINT "RealtimeTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
