ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "customer_number" TEXT;

WITH numbered_users AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY "createdAt", id) AS sequence_number
  FROM "users"
  WHERE "customer_number" IS NULL
)
UPDATE "users" AS u
SET "customer_number" = 'CLI-' || LPAD(numbered_users.sequence_number::TEXT, 6, '0')
FROM numbered_users
WHERE u.id = numbered_users.id;

CREATE UNIQUE INDEX IF NOT EXISTS "users_customer_number_key" ON "users"("customer_number");

INSERT INTO "counters" ("id", "sequence_value")
SELECT
  'customerNumber',
  COALESCE(MAX(NULLIF(REGEXP_REPLACE("customer_number", '\D', '', 'g'), '')::INT), 0)
FROM "users"
ON CONFLICT ("id") DO UPDATE
SET "sequence_value" = GREATEST("counters"."sequence_value", EXCLUDED."sequence_value");
