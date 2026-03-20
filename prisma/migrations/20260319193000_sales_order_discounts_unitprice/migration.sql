-- Sales order discounts + unit prices

-- Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SalesOrderDiscountMode') THEN
    CREATE TYPE "SalesOrderDiscountMode" AS ENUM ('SUBTOTAL', 'PER_ITEM');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DiscountType') THEN
    CREATE TYPE "DiscountType" AS ENUM ('VALUE', 'PERCENT');
  END IF;
END $$;

-- SalesOrder fields
ALTER TABLE "SalesOrder"
  ADD COLUMN IF NOT EXISTS "discountMode" "SalesOrderDiscountMode" NOT NULL DEFAULT 'SUBTOTAL',
  ADD COLUMN IF NOT EXISTS "discountType" "DiscountType",
  ADD COLUMN IF NOT EXISTS "discountValue" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "discountPercent" DECIMAL(5,2);

-- SalesOrderItem fields
ALTER TABLE "SalesOrderItem"
  ADD COLUMN IF NOT EXISTS "unitPrice" DECIMAL(12,2);

-- Backfill unitPrice = 0 for existing rows, then set NOT NULL
UPDATE "SalesOrderItem" SET "unitPrice" = 0 WHERE "unitPrice" IS NULL;

ALTER TABLE "SalesOrderItem"
  ALTER COLUMN "unitPrice" SET NOT NULL;

ALTER TABLE "SalesOrderItem"
  ADD COLUMN IF NOT EXISTS "discountType" "DiscountType",
  ADD COLUMN IF NOT EXISTS "discountValue" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "discountPercent" DECIMAL(5,2);
