-- CreateEnum
CREATE TYPE "AuditCategory" AS ENUM ('CRUD', 'PERMISSIONS', 'AUTH');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'GRANT', 'REVOKE');

-- CreateTable
CREATE TABLE "WorkspaceSetting" (
    "workspaceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceSetting_pkey" PRIMARY KEY ("workspaceId","key")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "category" "AuditCategory" NOT NULL,
    "action" "AuditAction" NOT NULL,
    "actorUserId" TEXT,
    "targetUserId" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "summary" TEXT,
    "changes" JSONB,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkspaceSetting_workspaceId_idx" ON "WorkspaceSetting"("workspaceId");

-- CreateIndex
CREATE INDEX "AuditEvent_workspaceId_idx" ON "AuditEvent"("workspaceId");

-- CreateIndex
CREATE INDEX "AuditEvent_workspaceId_createdAt_idx" ON "AuditEvent"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_workspaceId_category_createdAt_idx" ON "AuditEvent"("workspaceId", "category", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_workspaceId_actorUserId_createdAt_idx" ON "AuditEvent"("workspaceId", "actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_workspaceId_entityType_entityId_createdAt_idx" ON "AuditEvent"("workspaceId", "entityType", "entityId", "createdAt");

-- AddForeignKey
ALTER TABLE "WorkspaceSetting" ADD CONSTRAINT "WorkspaceSetting_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
