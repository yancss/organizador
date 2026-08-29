-- AlterEnum
ALTER TYPE "PurchaseOrderStatus" ADD VALUE 'PARTIALLY_RECEIVED';

-- AlterTable
ALTER TABLE "PurchaseOrderItem"
ADD COLUMN "receivedQty" DECIMAL(14,3) NOT NULL DEFAULT 0;
