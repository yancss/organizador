ALTER TABLE "PurchaseOrderItem"
ADD COLUMN "acceptedQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
ADD COLUMN "rejectedQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
ADD COLUMN "receiptObservation" TEXT;

UPDATE "PurchaseOrderItem"
SET "acceptedQty" = "receivedQty"
WHERE "receivedQty" <> 0;
