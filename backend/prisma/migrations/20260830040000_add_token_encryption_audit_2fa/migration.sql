ALTER TABLE "users"
  ADD COLUMN "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "two_factor_secret" TEXT,
  ADD COLUMN "two_factor_recovery_codes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "audit_logs" (
  "id" TEXT NOT NULL,
  "actor_id" TEXT,
  "actor_email" TEXT,
  "action" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'GENERAL',
  "entity_type" TEXT,
  "entity_id" TEXT,
  "outcome" TEXT NOT NULL DEFAULT 'SUCCESS',
  "method" TEXT,
  "path" TEXT,
  "status_code" INTEGER,
  "ip_hash" TEXT,
  "user_agent" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");
CREATE INDEX "audit_logs_category_created_at_idx" ON "audit_logs"("category", "created_at");
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
