-- Per-user permission overrides. Role permissions remain the base; grants add access
-- and denies remove access for a specific user.
CREATE TABLE "user_permission_grants" (
    "user_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_permission_grants_pkey" PRIMARY KEY ("user_id","permission_id")
);

CREATE TABLE "user_permission_denies" (
    "user_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_permission_denies_pkey" PRIMARY KEY ("user_id","permission_id")
);

CREATE INDEX "user_permission_grants_permission_id_idx" ON "user_permission_grants"("permission_id");
CREATE INDEX "user_permission_denies_permission_id_idx" ON "user_permission_denies"("permission_id");

ALTER TABLE "user_permission_grants"
ADD CONSTRAINT "user_permission_grants_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_permission_grants"
ADD CONSTRAINT "user_permission_grants_permission_id_fkey"
FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_permission_denies"
ADD CONSTRAINT "user_permission_denies_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_permission_denies"
ADD CONSTRAINT "user_permission_denies_permission_id_fkey"
FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "assistant_profiles"
SET "avatar_url" = '/images/tecatl-bot.png'
WHERE "store_id" = 'default'
  AND ("avatar_url" IS NULL OR "avatar_url" = '/images/logo2.png');
