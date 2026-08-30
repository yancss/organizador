-- CreateTable
CREATE TABLE "EntityFieldConfig" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "entity" VARCHAR(64) NOT NULL,
    "fieldName" VARCHAR(64) NOT NULL,
    "label" VARCHAR(120),
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "editable" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntityFieldConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EntityFieldConfig_workspaceId_entity_idx" ON "EntityFieldConfig"("workspaceId", "entity");

-- CreateIndex
CREATE UNIQUE INDEX "EntityFieldConfig_workspaceId_entity_fieldName_key" ON "EntityFieldConfig"("workspaceId", "entity", "fieldName");

-- AddForeignKey
ALTER TABLE "EntityFieldConfig" ADD CONSTRAINT "EntityFieldConfig_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
