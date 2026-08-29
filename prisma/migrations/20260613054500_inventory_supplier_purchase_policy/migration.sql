ALTER TABLE "Inventory"
ADD COLUMN "supplierLeadTimeDays" INTEGER,
ADD COLUMN "supplierMinOrderQty" DECIMAL(14,3),
ADD COLUMN "supplierOrderMultiple" DECIMAL(14,3);
