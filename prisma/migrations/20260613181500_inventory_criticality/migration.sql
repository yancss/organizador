CREATE TYPE "InventoryCriticality" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

ALTER TABLE "Inventory"
ADD COLUMN "criticality" "InventoryCriticality" NOT NULL DEFAULT 'MEDIUM';
