CREATE TYPE "SupplierWeekday" AS ENUM (
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY'
);

ALTER TABLE "Client"
ADD COLUMN "supplierOrderDays" "SupplierWeekday"[] DEFAULT ARRAY[]::"SupplierWeekday"[],
ADD COLUMN "supplierDeliveryDays" "SupplierWeekday"[] DEFAULT ARRAY[]::"SupplierWeekday"[];
