CREATE TABLE IF NOT EXISTS "whatsapp_chats" (
    "id" TEXT NOT NULL,
    "jid" TEXT NOT NULL,
    "phone" TEXT,
    "name" TEXT,
    "last_message" TEXT,
    "unread_count" INTEGER NOT NULL DEFAULT 0,
    "last_message_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_chats_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "whatsapp_messages" (
    "id" TEXT NOT NULL,
    "message_id" TEXT,
    "direction" TEXT NOT NULL,
    "from_me" BOOLEAN NOT NULL DEFAULT false,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "sent_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chat_id" TEXT NOT NULL,

    CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_chats_jid_key" ON "whatsapp_chats"("jid");
CREATE INDEX IF NOT EXISTS "whatsapp_chats_last_message_at_idx" ON "whatsapp_chats"("last_message_at");
CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_messages_message_id_key" ON "whatsapp_messages"("message_id");
CREATE INDEX IF NOT EXISTS "whatsapp_messages_chat_id_created_at_idx" ON "whatsapp_messages"("chat_id", "created_at");

ALTER TABLE "whatsapp_messages"
ADD CONSTRAINT "whatsapp_messages_chat_id_fkey"
FOREIGN KEY ("chat_id") REFERENCES "whatsapp_chats"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "name", "description", "createdAt", "updatedAt")
VALUES
  ('perm_whatsapp_chat', 'whatsapp:chat', 'Atender conversaciones de WhatsApp desde el panel', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_system_configure', 'system:configure', 'Ver y modificar configuracion sensible del sistema', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "_PermissionToRole" ("A", "B")
SELECT p."id", r."id"
FROM "permissions" p
CROSS JOIN "roles" r
WHERE r."name" = 'SUPER_ADMIN'
  AND p."name" IN ('whatsapp:chat', 'system:configure')
ON CONFLICT DO NOTHING;
