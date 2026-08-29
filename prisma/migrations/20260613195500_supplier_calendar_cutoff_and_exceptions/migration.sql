ALTER TABLE "Client"
ADD COLUMN "supplierOrderCutoffHour" INTEGER,
ADD COLUMN "supplierBlockedDates" TEXT[] DEFAULT ARRAY[]::TEXT[];
