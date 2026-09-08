ALTER TABLE "whatsapp_messages"
  ADD COLUMN "operation_id" TEXT,
  ADD COLUMN "source" TEXT DEFAULT 'BAILEYS',
  ADD COLUMN "requested_identity" TEXT,
  ADD COLUMN "requested_identity_type" TEXT,
  ADD COLUMN "resolved_jid" TEXT,
  ADD COLUMN "resolved_identity_type" TEXT,
  ADD COLUMN "error_code" INTEGER,
  ADD COLUMN "connection_status" TEXT,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "whatsapp_messages_operation_id_key" ON "whatsapp_messages"("operation_id");
