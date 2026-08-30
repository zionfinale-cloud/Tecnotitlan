CREATE TABLE "page_views" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "visitor_hash" TEXT NOT NULL,
    "referrer_host" TEXT,
    "source" TEXT NOT NULL DEFAULT 'DIRECT',
    "campaign" TEXT,
    "country" TEXT,
    "region" TEXT,
    "device" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "page_views_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "page_views_occurred_at_idx" ON "page_views"("occurred_at");
CREATE INDEX "page_views_path_occurred_at_idx" ON "page_views"("path", "occurred_at");
CREATE INDEX "page_views_source_occurred_at_idx" ON "page_views"("source", "occurred_at");
CREATE INDEX "page_views_country_occurred_at_idx" ON "page_views"("country", "occurred_at");
CREATE INDEX "page_views_visitor_hash_occurred_at_idx" ON "page_views"("visitor_hash", "occurred_at");
