-- CreateTable
CREATE TABLE "EntityConfig" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "entity" VARCHAR(64) NOT NULL,
    "label" VARCHAR(120),
    "description" VARCHAR(400),
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntityConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EntityConfig_workspaceId_idx" ON "EntityConfig"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "EntityConfig_workspaceId_entity_key" ON "EntityConfig"("workspaceId", "entity");

-- AddForeignKey
ALTER TABLE "EntityConfig" ADD CONSTRAINT "EntityConfig_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
