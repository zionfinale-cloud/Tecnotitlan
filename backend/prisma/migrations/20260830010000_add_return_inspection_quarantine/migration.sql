CREATE TABLE "return_inspection_cases" (
    "id" TEXT NOT NULL,
    "case_number" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "status" TEXT NOT NULL DEFAULT 'QUARANTINED',
    "quarantine_location" TEXT NOT NULL,
    "package_condition" TEXT,
    "sealed_package" BOOLEAN,
    "reception_evidence" JSONB,
    "notes" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "received_by_id" TEXT,
    "received_by" TEXT,
    "finalized_at" TIMESTAMP(3),
    "finalized_by_id" TEXT,
    "finalized_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "order_id" TEXT NOT NULL,
    "claim_id" TEXT,
    CONSTRAINT "return_inspection_cases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "return_inspection_items" (
    "id" TEXT NOT NULL,
    "expected_qty" INTEGER NOT NULL,
    "received_qty" INTEGER NOT NULL,
    "inspected_qty" INTEGER NOT NULL DEFAULT 0,
    "condition" TEXT NOT NULL DEFAULT 'PENDING',
    "disposition" TEXT NOT NULL DEFAULT 'HOLD',
    "serial_numbers" JSONB,
    "evidence_urls" JSONB,
    "checklist" JSONB,
    "notes" TEXT,
    "released_qty" INTEGER NOT NULL DEFAULT 0,
    "released_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "case_id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    CONSTRAINT "return_inspection_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "return_inspection_cases_case_number_key" ON "return_inspection_cases"("case_number");
CREATE UNIQUE INDEX "return_inspection_cases_claim_id_key" ON "return_inspection_cases"("claim_id");
CREATE INDEX "return_inspection_cases_status_received_at_idx" ON "return_inspection_cases"("status", "received_at");
CREATE INDEX "return_inspection_cases_order_id_created_at_idx" ON "return_inspection_cases"("order_id", "created_at");
CREATE UNIQUE INDEX "return_inspection_items_case_id_order_item_id_key" ON "return_inspection_items"("case_id", "order_item_id");
CREATE INDEX "return_inspection_items_product_id_disposition_idx" ON "return_inspection_items"("product_id", "disposition");

ALTER TABLE "return_inspection_cases" ADD CONSTRAINT "return_inspection_cases_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "return_inspection_cases" ADD CONSTRAINT "return_inspection_cases_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "meli_claims"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "return_inspection_items" ADD CONSTRAINT "return_inspection_items_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "return_inspection_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "return_inspection_items" ADD CONSTRAINT "return_inspection_items_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "return_inspection_items" ADD CONSTRAINT "return_inspection_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
