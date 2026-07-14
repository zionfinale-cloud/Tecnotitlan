ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "notification_email_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "notification_whatsapp_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "notification_whatsapp" TEXT;

ALTER TABLE "orders"
ADD COLUMN IF NOT EXISTS "sales_channel" "SalesChannel" NOT NULL DEFAULT 'WEB';

CREATE TABLE IF NOT EXISTS "whatsapp_auth_files" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'baileys',
  "relative_path" TEXT NOT NULL,
  "content" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "whatsapp_auth_files_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_auth_files_provider_relative_path_key"
ON "whatsapp_auth_files"("provider", "relative_path");
