-- Mercado Libre questions, post-sale conversations and communication audit trail.
CREATE TABLE "meli_questions" (
    "id" TEXT NOT NULL,
    "external_question_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "seller_id" TEXT,
    "buyer_id" TEXT,
    "status" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "answer_text" TEXT,
    "answer_status" TEXT,
    "asked_at" TIMESTAMP(3),
    "answered_at" TIMESTAMP(3),
    "assigned_to" TEXT,
    "internal_status" TEXT NOT NULL DEFAULT 'PENDING',
    "raw_data" JSONB NOT NULL,
    "last_synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "product_id" TEXT,
    CONSTRAINT "meli_questions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "meli_post_sale_conversations" (
    "id" TEXT NOT NULL,
    "pack_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "buyer_id" TEXT,
    "status" TEXT,
    "substatus" TEXT,
    "unread_count" INTEGER NOT NULL DEFAULT 0,
    "max_message_length" INTEGER NOT NULL DEFAULT 350,
    "assigned_to" TEXT,
    "internal_status" TEXT NOT NULL DEFAULT 'PENDING',
    "last_message_at" TIMESTAMP(3),
    "raw_data" JSONB,
    "last_synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "order_id" TEXT,
    CONSTRAINT "meli_post_sale_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "meli_post_sale_messages" (
    "id" TEXT NOT NULL,
    "external_message_id" TEXT NOT NULL,
    "from_user_id" TEXT,
    "to_user_id" TEXT,
    "direction" TEXT NOT NULL,
    "status" TEXT,
    "moderation_status" TEXT,
    "text" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "attachments" JSONB,
    "raw_data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "conversation_id" TEXT NOT NULL,
    CONSTRAINT "meli_post_sale_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "meli_communication_activities" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor_id" TEXT,
    "actor_name" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "meli_communication_activities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "meli_questions_external_question_id_key" ON "meli_questions"("external_question_id");
CREATE INDEX "meli_questions_status_asked_at_idx" ON "meli_questions"("status", "asked_at");
CREATE INDEX "meli_questions_internal_status_updated_at_idx" ON "meli_questions"("internal_status", "updated_at");
CREATE INDEX "meli_questions_item_id_idx" ON "meli_questions"("item_id");
CREATE INDEX "meli_questions_product_id_idx" ON "meli_questions"("product_id");
CREATE UNIQUE INDEX "meli_post_sale_conversations_pack_id_key" ON "meli_post_sale_conversations"("pack_id");
CREATE INDEX "meli_post_sale_conversations_unread_count_last_message_at_idx" ON "meli_post_sale_conversations"("unread_count", "last_message_at");
CREATE INDEX "meli_post_sale_conversations_internal_status_updated_at_idx" ON "meli_post_sale_conversations"("internal_status", "updated_at");
CREATE INDEX "meli_post_sale_conversations_order_id_idx" ON "meli_post_sale_conversations"("order_id");
CREATE UNIQUE INDEX "meli_post_sale_messages_external_message_id_key" ON "meli_post_sale_messages"("external_message_id");
CREATE INDEX "meli_post_sale_messages_conversation_id_sent_at_idx" ON "meli_post_sale_messages"("conversation_id", "sent_at");
CREATE INDEX "meli_post_sale_messages_direction_read_at_idx" ON "meli_post_sale_messages"("direction", "read_at");
CREATE INDEX "meli_communication_activities_entity_type_external_id_created_at_idx" ON "meli_communication_activities"("entity_type", "external_id", "created_at");

ALTER TABLE "meli_questions" ADD CONSTRAINT "meli_questions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "meli_post_sale_conversations" ADD CONSTRAINT "meli_post_sale_conversations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "meli_post_sale_messages" ADD CONSTRAINT "meli_post_sale_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "meli_post_sale_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
