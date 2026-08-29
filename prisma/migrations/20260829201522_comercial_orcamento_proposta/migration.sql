-- CreateEnum
CREATE TYPE "SalesQuoteStatus" AS ENUM ('DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'EXPIRED', 'CONVERTED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "ApprovalEntityType" ADD VALUE 'SALES_QUOTE';

-- AlterTable
ALTER TABLE "ApprovalRequest" ADD COLUMN     "salesQuoteId" TEXT;

-- AlterTable
ALTER TABLE "InventoryLot" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "SalesQuote" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "code" VARCHAR(32),
    "createdById" TEXT,
    "updatedById" TEXT,
    "name" TEXT NOT NULL,
    "observations" TEXT,
    "clientId" TEXT,
    "validUntil" TIMESTAMP(3),
    "status" "SalesQuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "discountMode" "SalesOrderDiscountMode" NOT NULL DEFAULT 'SUBTOTAL',
    "discountType" "DiscountType",
    "discountValue" DECIMAL(12,2),
    "discountPercent" DECIMAL(5,2),
    "value" DECIMAL(12,2),
    "sentAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "convertedAt" TIMESTAMP(3),
    "salesOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesQuoteItem" (
    "id" TEXT NOT NULL,
    "salesQuoteId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "discountType" "DiscountType",
    "discountValue" DECIMAL(12,2),
    "discountPercent" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesQuoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalesQuote_salesOrderId_key" ON "SalesQuote"("salesOrderId");

-- CreateIndex
CREATE INDEX "SalesQuote_workspaceId_idx" ON "SalesQuote"("workspaceId");

-- CreateIndex
CREATE INDEX "SalesQuote_ownerId_idx" ON "SalesQuote"("ownerId");

-- CreateIndex
CREATE INDEX "SalesQuote_clientId_idx" ON "SalesQuote"("clientId");

-- CreateIndex
CREATE INDEX "SalesQuote_status_idx" ON "SalesQuote"("status");

-- CreateIndex
CREATE INDEX "SalesQuote_validUntil_idx" ON "SalesQuote"("validUntil");

-- CreateIndex
CREATE UNIQUE INDEX "SalesQuote_workspaceId_code_key" ON "SalesQuote"("workspaceId", "code");

-- CreateIndex
CREATE INDEX "SalesQuoteItem_salesQuoteId_idx" ON "SalesQuoteItem"("salesQuoteId");

-- CreateIndex
CREATE INDEX "SalesQuoteItem_productId_idx" ON "SalesQuoteItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesQuoteItem_salesQuoteId_productId_key" ON "SalesQuoteItem"("salesQuoteId", "productId");

-- AddForeignKey
ALTER TABLE "SalesQuote" ADD CONSTRAINT "SalesQuote_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesQuote" ADD CONSTRAINT "SalesQuote_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesQuote" ADD CONSTRAINT "SalesQuote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesQuote" ADD CONSTRAINT "SalesQuote_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesQuoteItem" ADD CONSTRAINT "SalesQuoteItem_salesQuoteId_fkey" FOREIGN KEY ("salesQuoteId") REFERENCES "SalesQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesQuoteItem" ADD CONSTRAINT "SalesQuoteItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_salesQuoteId_fkey" FOREIGN KEY ("salesQuoteId") REFERENCES "SalesQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "InventoryLotEvent_workspaceId_referenceType_referenceId_created" RENAME TO "InventoryLotEvent_workspaceId_referenceType_referenceId_cre_idx";
