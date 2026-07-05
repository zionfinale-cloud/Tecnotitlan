CREATE TABLE IF NOT EXISTS "tiktok_shop_integrations" (
    "id" TEXT NOT NULL,
    "open_id" TEXT,
    "seller_name" TEXT,
    "seller_id" TEXT,
    "shop_name" TEXT,
    "shop_cipher" TEXT,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token_expires_at" TIMESTAMP(3),
    "refresh_token_expires_at" TIMESTAMP(3),
    "connected_by" TEXT,
    "raw_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tiktok_shop_integrations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tiktok_shop_integrations_open_id_idx" ON "tiktok_shop_integrations"("open_id");
