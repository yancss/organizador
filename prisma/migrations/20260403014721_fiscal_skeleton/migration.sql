-- CreateEnum
CREATE TYPE "CountryCode" AS ENUM ('BR', 'PT', 'ES');

-- CreateEnum
CREATE TYPE "TaxIdType" AS ENUM ('CNPJ', 'CPF', 'NIF', 'CIF');

-- CreateEnum
CREATE TYPE "CompanyBranchType" AS ENUM ('HQ', 'BRANCH');

-- CreateEnum
CREATE TYPE "FiscalDocumentKind" AS ENUM ('SALE', 'PURCHASE', 'SERVICE');

-- CreateEnum
CREATE TYPE "FiscalDocumentStatus" AS ENUM ('DRAFT', 'ISSUED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BrNfeEnvironment" AS ENUM ('HOMOLOGATION', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "BrNfeStatus" AS ENUM ('DRAFT', 'PENDING_TRANSMISSION', 'AUTHORIZED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT,
    "country" "CountryCode" NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyBranch" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "CompanyBranchType" NOT NULL DEFAULT 'HQ',
    "code" VARCHAR(32) NOT NULL,
    "country" "CountryCode" NOT NULL,
    "taxIdType" "TaxIdType" NOT NULL,
    "taxId" VARCHAR(32) NOT NULL,
    "brIe" VARCHAR(32),
    "brCrt" INTEGER,
    "brNfeSeries" VARCHAR(16),
    "brNfeNextNumber" INTEGER,
    "brNfeEnvironment" "BrNfeEnvironment",
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" VARCHAR(32),
    "postalCode" VARCHAR(16),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyBranch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalDocument" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "country" "CountryCode" NOT NULL,
    "kind" "FiscalDocumentKind" NOT NULL DEFAULT 'SALE',
    "status" "FiscalDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "salesOrderId" TEXT,
    "deliveryId" TEXT,
    "clientId" TEXT,
    "clientName" TEXT,
    "clientTaxIdType" "TaxIdType",
    "clientTaxId" VARCHAR(32),
    "clientAddressLine1" TEXT,
    "clientAddressLine2" TEXT,
    "clientCity" TEXT,
    "clientState" VARCHAR(32),
    "clientPostalCode" VARCHAR(16),
    "clientCountry" "CountryCode",
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxesTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalDocumentLine" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "lineType" VARCHAR(16) NOT NULL,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "qty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "unit" VARCHAR(16),
    "price" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxesJson" JSONB,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalDocumentLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrNfe" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "environment" "BrNfeEnvironment" NOT NULL DEFAULT 'HOMOLOGATION',
    "status" "BrNfeStatus" NOT NULL DEFAULT 'DRAFT',
    "series" VARCHAR(16),
    "number" INTEGER,
    "accessKey" VARCHAR(64),
    "xmlDraft" TEXT,
    "xmlAuthorized" TEXT,
    "protocol" TEXT,
    "rejection" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrNfe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Company_workspaceId_idx" ON "Company"("workspaceId");

-- CreateIndex
CREATE INDEX "CompanyBranch_workspaceId_idx" ON "CompanyBranch"("workspaceId");

-- CreateIndex
CREATE INDEX "CompanyBranch_companyId_idx" ON "CompanyBranch"("companyId");

-- CreateIndex
CREATE INDEX "CompanyBranch_country_idx" ON "CompanyBranch"("country");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyBranch_workspaceId_companyId_code_key" ON "CompanyBranch"("workspaceId", "companyId", "code");

-- CreateIndex
CREATE INDEX "FiscalDocument_workspaceId_idx" ON "FiscalDocument"("workspaceId");

-- CreateIndex
CREATE INDEX "FiscalDocument_branchId_idx" ON "FiscalDocument"("branchId");

-- CreateIndex
CREATE INDEX "FiscalDocument_status_idx" ON "FiscalDocument"("status");

-- CreateIndex
CREATE INDEX "FiscalDocument_kind_idx" ON "FiscalDocument"("kind");

-- CreateIndex
CREATE INDEX "FiscalDocument_salesOrderId_idx" ON "FiscalDocument"("salesOrderId");

-- CreateIndex
CREATE INDEX "FiscalDocument_deliveryId_idx" ON "FiscalDocument"("deliveryId");

-- CreateIndex
CREATE INDEX "FiscalDocument_clientId_idx" ON "FiscalDocument"("clientId");

-- CreateIndex
CREATE INDEX "FiscalDocumentLine_workspaceId_idx" ON "FiscalDocumentLine"("workspaceId");

-- CreateIndex
CREATE INDEX "FiscalDocumentLine_documentId_idx" ON "FiscalDocumentLine"("documentId");

-- CreateIndex
CREATE INDEX "FiscalDocumentLine_productId_idx" ON "FiscalDocumentLine"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "BrNfe_documentId_key" ON "BrNfe"("documentId");

-- CreateIndex
CREATE INDEX "BrNfe_workspaceId_idx" ON "BrNfe"("workspaceId");

-- CreateIndex
CREATE INDEX "BrNfe_status_idx" ON "BrNfe"("status");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyBranch" ADD CONSTRAINT "CompanyBranch_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyBranch" ADD CONSTRAINT "CompanyBranch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalDocument" ADD CONSTRAINT "FiscalDocument_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalDocument" ADD CONSTRAINT "FiscalDocument_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "CompanyBranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalDocument" ADD CONSTRAINT "FiscalDocument_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalDocument" ADD CONSTRAINT "FiscalDocument_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalDocument" ADD CONSTRAINT "FiscalDocument_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalDocumentLine" ADD CONSTRAINT "FiscalDocumentLine_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalDocumentLine" ADD CONSTRAINT "FiscalDocumentLine_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "FiscalDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalDocumentLine" ADD CONSTRAINT "FiscalDocumentLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrNfe" ADD CONSTRAINT "BrNfe_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrNfe" ADD CONSTRAINT "BrNfe_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "FiscalDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
