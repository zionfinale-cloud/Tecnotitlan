INSERT INTO "settings" ("id", "key", "value", "type", "isEditable", "createdAt", "updatedAt")
VALUES
  ('setting_social_facebook', 'social_facebook', 'https://www.facebook.com/profile.php?id=61591872000643', 'string', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('setting_social_tiktok', 'social_tiktok', 'https://www.tiktok.com/@tecnotitlan_mx', 'string', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('setting_social_whatsapp', 'social_whatsapp', 'https://wa.me/523481510949', 'string', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE
SET "value" = EXCLUDED."value",
    "type" = EXCLUDED."type",
    "isEditable" = EXCLUDED."isEditable",
    "updatedAt" = CURRENT_TIMESTAMP;
