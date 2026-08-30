CREATE TABLE "unified_inbox_links" (
    "id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "link_method" TEXT NOT NULL DEFAULT 'MANUAL',
    "confidence" INTEGER NOT NULL DEFAULT 100,
    "linked_by_id" TEXT,
    "linked_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "order_id" TEXT NOT NULL,
    CONSTRAINT "unified_inbox_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "unified_inbox_links_source_type_source_id_key" ON "unified_inbox_links"("source_type", "source_id");
CREATE INDEX "unified_inbox_links_order_id_idx" ON "unified_inbox_links"("order_id");
ALTER TABLE "unified_inbox_links" ADD CONSTRAINT "unified_inbox_links_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "unified_inbox_replies" (
    "id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'OUTBOUND',
    "text" TEXT NOT NULL,
    "delivery_status" TEXT NOT NULL DEFAULT 'SENT',
    "actor_id" TEXT,
    "actor_name" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "unified_inbox_replies_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "unified_inbox_replies_source_type_source_id_created_at_idx" ON "unified_inbox_replies"("source_type", "source_id", "created_at");
