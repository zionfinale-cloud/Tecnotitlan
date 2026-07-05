INSERT INTO "permissions" ("id", "name", "description", "createdAt", "updatedAt")
VALUES
  ('perm_finance_read_costs', 'finance:read_costs', 'Ver costos, inversiones, margenes y utilidad', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "_PermissionToRole" ("A", "B")
SELECT p."id", r."id"
FROM "permissions" p
CROSS JOIN "roles" r
WHERE r."name" = 'SUPER_ADMIN'
  AND p."name" = 'finance:read_costs'
ON CONFLICT DO NOTHING;
