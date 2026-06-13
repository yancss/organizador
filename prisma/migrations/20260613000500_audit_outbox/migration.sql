-- CreateEnum
CREATE TYPE "AuditOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'FAILED');

-- CreateTable
CREATE TABLE "AuditOutbox" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "AuditOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditOutbox_workspaceId_status_availableAt_idx" ON "AuditOutbox"("workspaceId", "status", "availableAt");

-- CreateIndex
CREATE INDEX "AuditOutbox_createdAt_idx" ON "AuditOutbox"("createdAt");
