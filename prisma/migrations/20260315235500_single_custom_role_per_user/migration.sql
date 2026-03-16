-- Enforce a single custom role per user per workspace

-- Drop old unique index (name may vary). Try common Prisma-generated pattern first.
DROP INDEX IF EXISTS "WorkspaceUserRole_workspaceId_userId_roleId_key";
DROP INDEX IF EXISTS "WorkspaceUserRole_workspace_user_role_key";

-- Ensure new unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceUserRole_workspace_user_key"
ON "WorkspaceUserRole"("workspaceId", "userId");
