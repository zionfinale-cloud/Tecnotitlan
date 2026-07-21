CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'WHATSAPP', 'N8N', 'SYSTEM');
CREATE TYPE "NotificationAudience" AS ENUM ('CUSTOMER', 'STAFF', 'ADMIN', 'SYSTEM');
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'SKIPPED', 'FAILED');

CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "audience" "NotificationAudience" NOT NULL DEFAULT 'SYSTEM',
    "event" TEXT NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL,
    "provider" TEXT,
    "recipient" TEXT,
    "order_id" TEXT,
    "order_number" TEXT,
    "message" TEXT,
    "error" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notification_logs_channel_status_created_at_idx" ON "notification_logs"("channel", "status", "created_at");
CREATE INDEX "notification_logs_order_id_created_at_idx" ON "notification_logs"("order_id", "created_at");

ALTER TABLE "notification_logs"
ADD CONSTRAINT "notification_logs_order_id_fkey"
FOREIGN KEY ("order_id") REFERENCES "orders"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
