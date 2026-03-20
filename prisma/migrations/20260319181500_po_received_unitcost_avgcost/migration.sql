-- Add RECEIVED status to PurchaseOrderStatus enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'PurchaseOrderStatus' AND e.enumlabel = 'RECEIVED'
  ) THEN
    ALTER TYPE "PurchaseOrderStatus" ADD VALUE 'RECEIVED';
  END IF;
END $$;

-- PurchaseOrder.receivedAt
ALTER TABLE "PurchaseOrder"
  ADD COLUMN IF NOT EXISTS "receivedAt" TIMESTAMP(3);

-- PurchaseOrderItem.unitCost
ALTER TABLE "PurchaseOrderItem"
  ADD COLUMN IF NOT EXISTS "unitCost" DECIMAL(12,2);

-- Product.avgCost
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "avgCost" DECIMAL(12,2);
