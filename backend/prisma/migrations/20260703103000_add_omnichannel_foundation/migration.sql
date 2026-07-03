-- CreateEnum
CREATE TYPE "SalesChannel" AS ENUM ('WEB', 'MERCADOLIBRE', 'TIKTOK_SHOP', 'AMAZON');

-- CreateEnum
CREATE TYPE "MarketplaceListingStatus" AS ENUM ('DRAFT', 'READY', 'ACTIVE', 'PAUSED', 'ERROR', 'ARCHIVED');

-- CreateTable
CREATE TABLE "marketplace_listings" (
    "id" TEXT NOT NULL,
    "channel" "SalesChannel" NOT NULL,
    "external_product_id" TEXT,
    "external_sku" TEXT,
    "title" TEXT,
    "price" DOUBLE PRECISION,
    "published_stock" INTEGER,
    "stock_buffer" INTEGER NOT NULL DEFAULT 0,
    "commission_rate" DOUBLE PRECISION,
    "shipping_cost_estimate" DOUBLE PRECISION,
    "status" "MarketplaceListingStatus" NOT NULL DEFAULT 'DRAFT',
    "sync_status" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "notes" TEXT,
    "raw_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "product_id" TEXT NOT NULL,

    CONSTRAINT "marketplace_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_orders" (
    "id" TEXT NOT NULL,
    "channel" "SalesChannel" NOT NULL,
    "external_order_id" TEXT NOT NULL,
    "external_status" TEXT,
    "customer_name" TEXT,
    "total_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "shipping_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fees_estimated" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "net_revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ordered_at" TIMESTAMP(3),
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw_data" JSONB,
    "order_id" TEXT,

    CONSTRAINT "external_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_listings_product_id_channel_key" ON "marketplace_listings"("product_id", "channel");

-- CreateIndex
CREATE INDEX "marketplace_listings_channel_status_idx" ON "marketplace_listings"("channel", "status");

-- CreateIndex
CREATE INDEX "marketplace_listings_external_product_id_idx" ON "marketplace_listings"("external_product_id");

-- CreateIndex
CREATE UNIQUE INDEX "external_orders_channel_external_order_id_key" ON "external_orders"("channel", "external_order_id");

-- CreateIndex
CREATE INDEX "external_orders_channel_imported_at_idx" ON "external_orders"("channel", "imported_at");

-- CreateIndex
CREATE INDEX "external_orders_order_id_idx" ON "external_orders"("order_id");

-- AddForeignKey
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_orders" ADD CONSTRAINT "external_orders_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
