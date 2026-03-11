-- CreateEnum
CREATE TYPE "StakeholderRole" AS ENUM ('CUSTOMER', 'SUPPLIER');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "roles" "StakeholderRole"[] DEFAULT ARRAY['CUSTOMER']::"StakeholderRole"[];

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "supplierId" TEXT;

-- CreateIndex
CREATE INDEX "PurchaseOrder_supplierId_idx" ON "PurchaseOrder"("supplierId");

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
