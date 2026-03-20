-- Add human-friendly document codes for SalesOrder and PurchaseOrder

-- SalesOrder.code
ALTER TABLE "SalesOrder"
  ADD COLUMN IF NOT EXISTS "code" VARCHAR(32);

-- PurchaseOrder.code
ALTER TABLE "PurchaseOrder"
  ADD COLUMN IF NOT EXISTS "code" VARCHAR(32);

-- Uniqueness per workspace (NULL codes are allowed and do not conflict)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'SalesOrder_workspaceId_code_key'
  ) THEN
    CREATE UNIQUE INDEX "SalesOrder_workspaceId_code_key" ON "SalesOrder"("workspaceId", "code");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'PurchaseOrder_workspaceId_code_key'
  ) THEN
    CREATE UNIQUE INDEX "PurchaseOrder_workspaceId_code_key" ON "PurchaseOrder"("workspaceId", "code");
  END IF;
END $$;
