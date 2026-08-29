-- CreateEnum
CREATE TYPE "PayableStatus" AS ENUM ('PLANNED', 'ACCRUED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApprovalEntityType" AS ENUM ('PURCHASE_ORDER', 'SALES_ORDER');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SalesOrderStatus" ADD VALUE 'SENT';
ALTER TYPE "SalesOrderStatus" ADD VALUE 'APPROVED';
ALTER TYPE "SalesOrderStatus" ADD VALUE 'REJECTED';
ALTER TYPE "SalesOrderStatus" ADD VALUE 'EXPIRED';

-- CreateTable
CREATE TABLE "Payable" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "purchaseOrderId" TEXT NOT NULL,
    "supplierId" TEXT,
    "status" "PayableStatus" NOT NULL DEFAULT 'PLANNED',
    "competenceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "plannedAmount" DECIMAL(12,2) NOT NULL,
    "accruedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "observations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "entityType" "ApprovalEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "policyKey" TEXT NOT NULL,
    "requestedById" TEXT,
    "decidedById" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(12,2),
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "salesOrderId" TEXT,
    "purchaseOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payable_workspaceId_idx" ON "Payable"("workspaceId");

-- CreateIndex
CREATE INDEX "Payable_supplierId_idx" ON "Payable"("supplierId");

-- CreateIndex
CREATE INDEX "Payable_status_idx" ON "Payable"("status");

-- CreateIndex
CREATE INDEX "Payable_competenceDate_idx" ON "Payable"("competenceDate");

-- CreateIndex
CREATE INDEX "Payable_receivedAt_idx" ON "Payable"("receivedAt");

-- CreateIndex
CREATE INDEX "Payable_paidAt_idx" ON "Payable"("paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payable_purchaseOrderId_key" ON "Payable"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_workspaceId_idx" ON "ApprovalRequest"("workspaceId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_entityType_entityId_idx" ON "ApprovalRequest"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_status_idx" ON "ApprovalRequest"("status");

-- CreateIndex
CREATE INDEX "ApprovalRequest_requestedById_idx" ON "ApprovalRequest"("requestedById");

-- CreateIndex
CREATE INDEX "ApprovalRequest_decidedById_idx" ON "ApprovalRequest"("decidedById");

-- AddForeignKey
ALTER TABLE "Payable" ADD CONSTRAINT "Payable_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payable" ADD CONSTRAINT "Payable_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payable" ADD CONSTRAINT "Payable_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
