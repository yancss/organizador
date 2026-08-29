CREATE TABLE "InventoryLot" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "warehouseId" TEXT,
  "purchaseOrderId" TEXT,
  "supplierId" TEXT,
  "createdById" TEXT,
  "updatedById" TEXT,
  "lotCode" VARCHAR(120) NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "quantity" DECIMAL(14,3) NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InventoryLot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InventoryLot_workspaceId_productId_idx" ON "InventoryLot"("workspaceId", "productId");
CREATE INDEX "InventoryLot_workspaceId_warehouseId_idx" ON "InventoryLot"("workspaceId", "warehouseId");
CREATE INDEX "InventoryLot_workspaceId_expiresAt_idx" ON "InventoryLot"("workspaceId", "expiresAt");
CREATE INDEX "InventoryLot_purchaseOrderId_idx" ON "InventoryLot"("purchaseOrderId");
CREATE INDEX "InventoryLot_supplierId_idx" ON "InventoryLot"("supplierId");

ALTER TABLE "InventoryLot"
ADD CONSTRAINT "InventoryLot_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryLot"
ADD CONSTRAINT "InventoryLot_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryLot"
ADD CONSTRAINT "InventoryLot_warehouseId_fkey"
FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InventoryLot"
ADD CONSTRAINT "InventoryLot_purchaseOrderId_fkey"
FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InventoryLot"
ADD CONSTRAINT "InventoryLot_supplierId_fkey"
FOREIGN KEY ("supplierId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
