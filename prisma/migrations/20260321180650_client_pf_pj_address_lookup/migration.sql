-- CreateEnum
CREATE TYPE "ClientEntityType" AS ENUM ('PERSON', 'COMPANY');

-- DropIndex
DROP INDEX "Permission_module_idx";

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "email" VARCHAR(254),
ADD COLUMN     "entityType" "ClientEntityType" NOT NULL DEFAULT 'PERSON';

-- RenameIndex
ALTER INDEX "WorkspaceRolePermission_role_perm_key" RENAME TO "WorkspaceRolePermission_roleId_permissionId_key";

-- RenameIndex
ALTER INDEX "WorkspaceUserRole_workspace_user_key" RENAME TO "WorkspaceUserRole_workspaceId_userId_key";
