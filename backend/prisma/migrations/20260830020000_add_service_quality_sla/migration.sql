CREATE TABLE "inbox_response_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source_type" TEXT,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "body" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "inbox_response_templates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "inbox_response_templates_source_type_is_active_idx" ON "inbox_response_templates"("source_type", "is_active");

CREATE TABLE "inbox_quality_reviews" (
    "id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "clarity" INTEGER NOT NULL,
    "empathy" INTEGER NOT NULL,
    "accuracy" INTEGER NOT NULL,
    "resolution" INTEGER NOT NULL,
    "compliance" INTEGER NOT NULL,
    "overall_score" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "reviewer_id" TEXT,
    "reviewer" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inbox_quality_reviews_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "inbox_quality_reviews_source_type_source_id_created_at_idx" ON "inbox_quality_reviews"("source_type", "source_id", "created_at");
CREATE INDEX "inbox_quality_reviews_overall_score_created_at_idx" ON "inbox_quality_reviews"("overall_score", "created_at");

INSERT INTO "inbox_response_templates" ("id", "name", "source_type", "category", "body", "updated_at") VALUES
('tpl_order_followup', 'Seguimiento de pedido', NULL, 'PEDIDO', 'Hola {{customer_name}}, revisé tu pedido {{order_number}}. {{agent_note}} Quedo pendiente para ayudarte.', CURRENT_TIMESTAMP),
('tpl_empathy_claim', 'Recepción empática de reclamo', 'MELI_CLAIM', 'RECLAMO', 'Hola, lamento lo ocurrido. Ya revisamos tu caso y estamos dando seguimiento dentro del plazo de Mercado Libre. Te mantendremos informado por este mismo medio.', CURRENT_TIMESTAMP),
('tpl_request_evidence', 'Solicitud de evidencia', NULL, 'EVIDENCIA', 'Para ayudarte de forma segura, por favor comparte fotos claras del producto, empaque, accesorios y número de serie. No publiques datos bancarios ni contraseñas.', CURRENT_TIMESTAMP),
('tpl_resolution_close', 'Confirmación de solución', NULL, 'CIERRE', 'Hola {{customer_name}}, confirmamos que la solución de tu caso quedó aplicada. Si todavía necesitas ayuda, responde por este mismo canal y con gusto lo revisamos.', CURRENT_TIMESTAMP);
