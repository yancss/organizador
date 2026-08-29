CREATE TABLE "InventoryLotEvent" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "warehouseId" TEXT,
  "lotId" TEXT,
  "eventType" VARCHAR(64) NOT NULL,
  "quantity" DECIMAL(14,3) NOT NULL,
  "serialCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "referenceType" VARCHAR(64),
  "referenceId" VARCHAR(191),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InventoryLotEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InventoryLotEvent_workspaceId_productId_createdAt_idx"
ON "InventoryLotEvent"("workspaceId", "productId", "createdAt");

CREATE INDEX "InventoryLotEvent_workspaceId_lotId_createdAt_idx"
ON "InventoryLotEvent"("workspaceId", "lotId", "createdAt");

CREATE INDEX "InventoryLotEvent_workspaceId_referenceType_referenceId_createdAt_idx"
ON "InventoryLotEvent"("workspaceId", "referenceType", "referenceId", "createdAt");
