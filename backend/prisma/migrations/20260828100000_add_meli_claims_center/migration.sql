CREATE TABLE "meli_claims" (
    "id" TEXT NOT NULL,
    "external_claim_id" TEXT NOT NULL,
    "external_order_id" TEXT,
    "seller_id" TEXT,
    "type" TEXT,
    "stage" TEXT,
    "status" TEXT NOT NULL,
    "resource" TEXT,
    "resource_id" TEXT,
    "reason_id" TEXT,
    "reason_detail" TEXT,
    "title" TEXT,
    "description" TEXT,
    "problem" TEXT,
    "action_responsible" TEXT,
    "due_date" TIMESTAMP(3),
    "affects_reputation" BOOLEAN,
    "return_id" TEXT,
    "return_status" TEXT,
    "return_shipment_id" TEXT,
    "return_tracking_number" TEXT,
    "return_cost" DOUBLE PRECISION,
    "return_currency" TEXT,
    "refund_at" TEXT,
    "money_status" TEXT,
    "internal_status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "priority" "TicketPriority" NOT NULL DEFAULT 'HIGH',
    "assigned_to" TEXT,
    "inspection_status" TEXT NOT NULL DEFAULT 'NOT_RECEIVED',
    "inspection_notes" TEXT,
    "raw_data" JSONB NOT NULL,
    "detail_data" JSONB,
    "messages_data" JSONB,
    "return_data" JSONB,
    "history_data" JSONB,
    "resolutions_data" JSONB,
    "last_synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "order_id" TEXT,
    CONSTRAINT "meli_claims_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "meli_claim_activities" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor_id" TEXT,
    "actor_name" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claim_id" TEXT NOT NULL,
    CONSTRAINT "meli_claim_activities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "meli_claims_external_claim_id_key" ON "meli_claims"("external_claim_id");
CREATE INDEX "meli_claims_status_due_date_idx" ON "meli_claims"("status", "due_date");
CREATE INDEX "meli_claims_internal_status_priority_idx" ON "meli_claims"("internal_status", "priority");
CREATE INDEX "meli_claims_external_order_id_idx" ON "meli_claims"("external_order_id");
CREATE INDEX "meli_claims_order_id_idx" ON "meli_claims"("order_id");
CREATE INDEX "meli_claim_activities_claim_id_created_at_idx" ON "meli_claim_activities"("claim_id", "created_at");

ALTER TABLE "meli_claims" ADD CONSTRAINT "meli_claims_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "meli_claim_activities" ADD CONSTRAINT "meli_claim_activities_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "meli_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;
