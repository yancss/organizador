-- Custom RBAC roles + permissions scoped to workspace

-- 1) Permissions catalog
CREATE TABLE IF NOT EXISTS "Permission" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Permission_key_key" ON "Permission"("key");
CREATE INDEX IF NOT EXISTS "Permission_module_idx" ON "Permission"("module");

-- 2) Workspace roles
CREATE TABLE IF NOT EXISTS "WorkspaceRoleModel" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isSystem" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkspaceRoleModel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceRoleModel_workspaceId_name_key" ON "WorkspaceRoleModel"("workspaceId", "name");
CREATE INDEX IF NOT EXISTS "WorkspaceRoleModel_workspaceId_idx" ON "WorkspaceRoleModel"("workspaceId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkspaceRoleModel_workspaceId_fkey') THEN
    ALTER TABLE "WorkspaceRoleModel" ADD CONSTRAINT "WorkspaceRoleModel_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

-- 3) Role -> Permission
CREATE TABLE IF NOT EXISTS "WorkspaceRolePermission" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "permissionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkspaceRolePermission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceRolePermission_role_perm_key" ON "WorkspaceRolePermission"("roleId", "permissionId");
CREATE INDEX IF NOT EXISTS "WorkspaceRolePermission_workspaceId_idx" ON "WorkspaceRolePermission"("workspaceId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkspaceRolePermission_workspaceId_fkey') THEN
    ALTER TABLE "WorkspaceRolePermission" ADD CONSTRAINT "WorkspaceRolePermission_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkspaceRolePermission_roleId_fkey') THEN
    ALTER TABLE "WorkspaceRolePermission" ADD CONSTRAINT "WorkspaceRolePermission_roleId_fkey"
      FOREIGN KEY ("roleId") REFERENCES "WorkspaceRoleModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkspaceRolePermission_permissionId_fkey') THEN
    ALTER TABLE "WorkspaceRolePermission" ADD CONSTRAINT "WorkspaceRolePermission_permissionId_fkey"
      FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

-- 4) User -> Role assignments
CREATE TABLE IF NOT EXISTS "WorkspaceUserRole" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkspaceUserRole_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceUserRole_workspace_user_role_key" ON "WorkspaceUserRole"("workspaceId", "userId", "roleId");
CREATE INDEX IF NOT EXISTS "WorkspaceUserRole_workspaceId_idx" ON "WorkspaceUserRole"("workspaceId");
CREATE INDEX IF NOT EXISTS "WorkspaceUserRole_userId_idx" ON "WorkspaceUserRole"("userId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkspaceUserRole_workspaceId_fkey') THEN
    ALTER TABLE "WorkspaceUserRole" ADD CONSTRAINT "WorkspaceUserRole_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkspaceUserRole_userId_fkey') THEN
    ALTER TABLE "WorkspaceUserRole" ADD CONSTRAINT "WorkspaceUserRole_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkspaceUserRole_roleId_fkey') THEN
    ALTER TABLE "WorkspaceUserRole" ADD CONSTRAINT "WorkspaceUserRole_roleId_fkey"
      FOREIGN KEY ("roleId") REFERENCES "WorkspaceRoleModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;
