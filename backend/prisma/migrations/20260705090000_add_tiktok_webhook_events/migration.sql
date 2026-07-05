CREATE TABLE IF NOT EXISTS "tiktok_shop_webhook_events" (
    "id" TEXT NOT NULL,
    "event_type" TEXT,
    "category" TEXT,
    "shop_id" TEXT,
    "shop_cipher" TEXT,
    "message_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "payload" JSONB NOT NULL,
    "headers" JSONB,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "tiktok_shop_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tiktok_shop_webhook_events_message_id_key" ON "tiktok_shop_webhook_events"("message_id");
CREATE INDEX IF NOT EXISTS "tiktok_shop_webhook_events_event_type_received_at_idx" ON "tiktok_shop_webhook_events"("event_type", "received_at");
CREATE INDEX IF NOT EXISTS "tiktok_shop_webhook_events_shop_id_idx" ON "tiktok_shop_webhook_events"("shop_id");
