CREATE TABLE IF NOT EXISTS "whatsapp_auth_state" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'baileys',
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "whatsapp_auth_state_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_auth_state_provider_key_key"
  ON "whatsapp_auth_state"("provider", "key");
