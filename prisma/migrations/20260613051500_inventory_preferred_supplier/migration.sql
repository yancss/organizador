ALTER TABLE "Inventory"
ADD COLUMN "preferredSupplierId" TEXT;

CREATE INDEX "Inventory_preferredSupplierId_idx" ON "Inventory"("preferredSupplierId");

ALTER TABLE "Inventory"
ADD CONSTRAINT "Inventory_preferredSupplierId_fkey"
FOREIGN KEY ("preferredSupplierId") REFERENCES "Client"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
