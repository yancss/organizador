CREATE TABLE "Warehouse" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "createdById" TEXT,
  "updatedById" TEXT,
  "name" TEXT NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryByWarehouse" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" DECIMAL(14,3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InventoryByWarehouse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryTransfer" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "fromWarehouseId" TEXT NOT NULL,
  "toWarehouseId" TEXT NOT NULL,
  "createdById" TEXT,
  "quantity" DECIMAL(14,3) NOT NULL,
  "observations" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InventoryTransfer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Warehouse_workspaceId_code_key" ON "Warehouse"("workspaceId", "code");
CREATE UNIQUE INDEX "Warehouse_workspaceId_name_key" ON "Warehouse"("workspaceId", "name");
CREATE INDEX "Warehouse_workspaceId_idx" ON "Warehouse"("workspaceId");

CREATE UNIQUE INDEX "InventoryByWarehouse_warehouseId_productId_key" ON "InventoryByWarehouse"("warehouseId", "productId");
CREATE INDEX "InventoryByWarehouse_workspaceId_idx" ON "InventoryByWarehouse"("workspaceId");
CREATE INDEX "InventoryByWarehouse_productId_idx" ON "InventoryByWarehouse"("productId");

CREATE INDEX "InventoryTransfer_workspaceId_idx" ON "InventoryTransfer"("workspaceId");
CREATE INDEX "InventoryTransfer_productId_idx" ON "InventoryTransfer"("productId");
CREATE INDEX "InventoryTransfer_fromWarehouseId_idx" ON "InventoryTransfer"("fromWarehouseId");
CREATE INDEX "InventoryTransfer_toWarehouseId_idx" ON "InventoryTransfer"("toWarehouseId");
CREATE INDEX "InventoryTransfer_createdAt_idx" ON "InventoryTransfer"("createdAt");

ALTER TABLE "Warehouse"
ADD CONSTRAINT "Warehouse_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryByWarehouse"
ADD CONSTRAINT "InventoryByWarehouse_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryByWarehouse"
ADD CONSTRAINT "InventoryByWarehouse_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryByWarehouse"
ADD CONSTRAINT "InventoryByWarehouse_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryTransfer"
ADD CONSTRAINT "InventoryTransfer_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryTransfer"
ADD CONSTRAINT "InventoryTransfer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryTransfer"
ADD CONSTRAINT "InventoryTransfer_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InventoryTransfer"
ADD CONSTRAINT "InventoryTransfer_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

WITH inserted_defaults AS (
  INSERT INTO "Warehouse" ("id", "workspaceId", "name", "code", "active", "isDefault", "createdAt", "updatedAt")
  SELECT
    'wh_' || substr(md5(random()::text || clock_timestamp()::text || w."id"), 1, 24),
    w."id",
    'Principal',
    'MAIN',
    true,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  FROM "Workspace" w
  WHERE NOT EXISTS (
    SELECT 1
    FROM "Warehouse" wh
    WHERE wh."workspaceId" = w."id"
      AND wh."isDefault" = true
  )
  RETURNING "id", "workspaceId"
)
INSERT INTO "InventoryByWarehouse" ("id", "workspaceId", "warehouseId", "productId", "quantity", "createdAt", "updatedAt")
SELECT
  'iw_' || substr(md5(random()::text || clock_timestamp()::text || i."id"), 1, 24),
  i."workspaceId",
  wh."id",
  i."productId",
  i."quantity",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Inventory" i
JOIN "Warehouse" wh
  ON wh."workspaceId" = i."workspaceId"
 AND wh."isDefault" = true
LEFT JOIN "InventoryByWarehouse" ibw
  ON ibw."warehouseId" = wh."id"
 AND ibw."productId" = i."productId"
WHERE ibw."id" IS NULL;
