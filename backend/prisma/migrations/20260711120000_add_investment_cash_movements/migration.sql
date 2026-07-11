CREATE TYPE "InvestmentCashMovementType" AS ENUM (
  'CAPITAL_IN',
  'OPERATING_EXPENSE',
  'UNEXPECTED_EXPENSE',
  'CASH_OUT',
  'ADJUSTMENT_IN'
);

CREATE TABLE "investment_cash_movements" (
  "id" TEXT NOT NULL,
  "type" "InvestmentCashMovementType" NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "investment_id" TEXT NOT NULL,
  "created_by_id" TEXT,

  CONSTRAINT "investment_cash_movements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "investment_cash_movements_investment_id_created_at_idx"
  ON "investment_cash_movements"("investment_id", "created_at");

CREATE INDEX "investment_cash_movements_type_created_at_idx"
  ON "investment_cash_movements"("type", "created_at");

ALTER TABLE "investment_cash_movements"
  ADD CONSTRAINT "investment_cash_movements_investment_id_fkey"
  FOREIGN KEY ("investment_id") REFERENCES "inventory_investments"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "investment_cash_movements"
  ADD CONSTRAINT "investment_cash_movements_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
