-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM (
  'MANUAL_ADJUSTMENT',
  'PURCHASE_RECEIPT',
  'PURCHASE_RECEIPT_REVERSAL',
  'PRODUCTION_CONSUMPTION',
  'PRODUCTION_OUTPUT',
  'DELIVERY_SHIPMENT',
  'DELIVERY_RETURN',
  'TRANSFER_OUT',
  'TRANSFER_IN'
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "warehouseId" TEXT,
  "transferId" TEXT,
  "actorUserId" TEXT,
  "movementType" "InventoryMovementType" NOT NULL,
  "quantity" DECIMAL(14,3) NOT NULL,
  "unitCost" DECIMAL(12,4),
  "referenceType" VARCHAR(64),
  "referenceId" VARCHAR(64),
  "observations" TEXT,
  "balanceAfterGlobal" DECIMAL(14,3),
  "balanceAfterWarehouse" DECIMAL(14,3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryMovement_workspaceId_createdAt_idx" ON "InventoryMovement"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_workspaceId_productId_createdAt_idx" ON "InventoryMovement"("workspaceId", "productId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_workspaceId_warehouseId_createdAt_idx" ON "InventoryMovement"("workspaceId", "warehouseId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_workspaceId_movementType_createdAt_idx" ON "InventoryMovement"("workspaceId", "movementType", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_transferId_idx" ON "InventoryMovement"("transferId");

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "InventoryTransfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
