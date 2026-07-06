CREATE TYPE "ChatChannel" AS ENUM ('WEB', 'WHATSAPP', 'ADMIN');
CREATE TYPE "ChatConversationStatus" AS ENUM ('OPEN', 'HUMAN_REQUIRED', 'CLOSED');
CREATE TYPE "ChatMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM', 'HUMAN');
CREATE TYPE "ConversationHandoffStatus" AS ENUM ('OPEN', 'ASSIGNED', 'RESOLVED');

CREATE TABLE "assistant_profiles" (
  "id" TEXT NOT NULL,
  "store_id" TEXT NOT NULL DEFAULT 'default',
  "name" TEXT NOT NULL DEFAULT 'Tecatl',
  "avatar_url" TEXT,
  "tone" TEXT NOT NULL DEFAULT 'amable, mexicano neutro, breve, confiable',
  "welcome_message" TEXT NOT NULL,
  "fallback_message" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "assistant_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chat_conversations" (
  "id" TEXT NOT NULL,
  "store_id" TEXT NOT NULL DEFAULT 'default',
  "channel" "ChatChannel" NOT NULL,
  "customer_id" TEXT,
  "external_user_id" TEXT,
  "customer_name" TEXT,
  "customer_email" TEXT,
  "status" "ChatConversationStatus" NOT NULL DEFAULT 'OPEN',
  "intent" TEXT,
  "last_message_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chat_messages" (
  "id" TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "role" "ChatMessageRole" NOT NULL,
  "content" TEXT NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "knowledge_articles" (
  "id" TEXT NOT NULL,
  "store_id" TEXT NOT NULL DEFAULT 'default',
  "title" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "knowledge_articles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conversation_handoffs" (
  "id" TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "ConversationHandoffStatus" NOT NULL DEFAULT 'OPEN',
  "assigned_to" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMP(3),
  CONSTRAINT "conversation_handoffs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assistant_settings" (
  "id" TEXT NOT NULL,
  "store_id" TEXT NOT NULL DEFAULT 'default',
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'string',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "assistant_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "assistant_profiles_store_id_key" ON "assistant_profiles"("store_id");
CREATE INDEX "chat_conversations_channel_status_idx" ON "chat_conversations"("channel", "status");
CREATE INDEX "chat_conversations_customer_id_idx" ON "chat_conversations"("customer_id");
CREATE INDEX "chat_conversations_last_message_at_idx" ON "chat_conversations"("last_message_at");
CREATE INDEX "chat_messages_conversation_id_created_at_idx" ON "chat_messages"("conversation_id", "created_at");
CREATE INDEX "knowledge_articles_category_is_active_idx" ON "knowledge_articles"("category", "is_active");
CREATE INDEX "conversation_handoffs_status_created_at_idx" ON "conversation_handoffs"("status", "created_at");
CREATE UNIQUE INDEX "assistant_settings_store_id_key_key" ON "assistant_settings"("store_id", "key");

ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_handoffs" ADD CONSTRAINT "conversation_handoffs_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_handoffs" ADD CONSTRAINT "conversation_handoffs_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "name", "description", "createdAt", "updatedAt")
VALUES
  ('perm_tecatl_read', 'tecatl:read', 'Ver conversaciones y estado de Tecatl', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_tecatl_manage', 'tecatl:manage', 'Configurar perfil y reglas de Tecatl', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_tecatl_reply', 'tecatl:reply', 'Responder conversaciones de Tecatl como humano', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_tecatl_knowledge', 'tecatl:knowledge', 'Administrar base de conocimiento de Tecatl', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_tecatl_handoff', 'tecatl:handoff', 'Gestionar escalamientos de Tecatl a humano', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO UPDATE SET
  "description" = EXCLUDED."description",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "_PermissionToRole" ("A", "B")
SELECT p."id", r."id"
FROM "permissions" p
JOIN "roles" r ON r."name" = 'SUPER_ADMIN'
WHERE p."name" IN ('tecatl:read', 'tecatl:manage', 'tecatl:reply', 'tecatl:knowledge', 'tecatl:handoff')
ON CONFLICT DO NOTHING;

INSERT INTO "_PermissionToRole" ("A", "B")
SELECT p."id", r."id"
FROM "permissions" p
JOIN "roles" r ON r."name" = 'ADMIN'
WHERE p."name" IN ('tecatl:read', 'tecatl:reply', 'tecatl:knowledge', 'tecatl:handoff')
ON CONFLICT DO NOTHING;

INSERT INTO "_PermissionToRole" ("A", "B")
SELECT p."id", r."id"
FROM "permissions" p
JOIN "roles" r ON r."name" IN ('SUPERVISOR', 'VENDEDOR')
WHERE p."name" IN ('tecatl:read', 'tecatl:reply', 'tecatl:handoff')
ON CONFLICT DO NOTHING;

INSERT INTO "assistant_profiles" ("id", "store_id", "name", "avatar_url", "tone", "welcome_message", "fallback_message", "is_active", "created_at", "updated_at")
VALUES (
  'assistant_profile_default_tecatl',
  'default',
  'Tecatl',
  '/images/logo2.png',
  'amable, mexicano neutro, natural, breve, vendedor sin ser insistente, tecnico cuando hace falta, confiable',
  'Hola. Soy Tecatl, asesor de Tecnotitlan. Estoy aqui para ayudarte a elegir el producto correcto, revisar pedidos o resolver cualquier duda.',
  'No quiero inventarte informacion. Te paso con un asesor humano para revisarlo bien.',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("store_id") DO NOTHING;

INSERT INTO "knowledge_articles" ("id", "store_id", "title", "category", "content", "tags", "is_active", "created_at", "updated_at")
VALUES
  (
    'knowledge_tecatl_garantias_default',
    'default',
    'Garantias y devoluciones',
    'garantias',
    'Tecnotitlan revisa cada caso de garantia y devolucion con el equipo de soporte. Para ayudar mejor, se solicita numero de pedido, correo de compra y evidencia del producto cuando aplique.',
    ARRAY['garantia', 'devolucion', 'cambio'],
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'knowledge_tecatl_envios_default',
    'default',
    'Envios',
    'envios',
    'Los tiempos de envio dependen del destino y del metodo seleccionado. Tecnotitlan comparte la guia cuando el pedido pasa a enviado.',
    ARRAY['envio', 'guia', 'rastreo'],
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("id") DO NOTHING;
