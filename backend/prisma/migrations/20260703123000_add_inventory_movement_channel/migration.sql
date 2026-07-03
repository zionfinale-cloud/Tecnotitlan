-- AlterTable
ALTER TABLE "inventory_movements" ADD COLUMN "channel" "SalesChannel";

-- CreateIndex
CREATE INDEX "inventory_movements_channel_created_at_idx" ON "inventory_movements"("channel", "created_at");
