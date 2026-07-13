CREATE TABLE "meli_integrations" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "meli_user_id" TEXT,
  "nickname" TEXT,
  "access_token" TEXT NOT NULL,
  "refresh_token" TEXT,
  "expires_in" INTEGER,
  "expires_at" TIMESTAMP(3),
  "token_type" TEXT,
  "scope" TEXT,
  "raw_data" JSONB,
  "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "meli_integrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "meli_integrations_user_id_key" ON "meli_integrations"("user_id");
CREATE INDEX "meli_integrations_meli_user_id_idx" ON "meli_integrations"("meli_user_id");

ALTER TABLE "meli_integrations"
ADD CONSTRAINT "meli_integrations_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
