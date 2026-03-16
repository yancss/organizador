-- RBAC + Invites

-- 1) Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
    CREATE TYPE "UserRole" AS ENUM ('USER', 'SUPERADMIN');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WorkspaceRole') THEN
    CREATE TYPE "WorkspaceRole" AS ENUM ('USER', 'ADMIN');
  END IF;
END$$;

-- 2) User.role (TEXT -> UserRole)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role_new" "UserRole";

UPDATE "User"
SET "role_new" = CASE
  WHEN lower(coalesce("email", '')) = 'support.guardian.app@gmail.com' THEN 'SUPERADMIN'::"UserRole"
  WHEN lower(coalesce("role", '')) IN ('superadmin') THEN 'SUPERADMIN'::"UserRole"
  ELSE 'USER'::"UserRole"
END
WHERE "role_new" IS NULL;

ALTER TABLE "User" ALTER COLUMN "role_new" SET DEFAULT 'USER';
ALTER TABLE "User" ALTER COLUMN "role_new" SET NOT NULL;

ALTER TABLE "User" DROP COLUMN IF EXISTS "role";
ALTER TABLE "User" RENAME COLUMN "role_new" TO "role";

-- 3) WorkspaceMember.role (TEXT -> WorkspaceRole)
ALTER TABLE "WorkspaceMember" ADD COLUMN IF NOT EXISTS "role_new" "WorkspaceRole";

UPDATE "WorkspaceMember"
SET "role_new" = CASE
  WHEN lower(coalesce("role", '')) IN ('owner', 'admin') THEN 'ADMIN'::"WorkspaceRole"
  ELSE 'USER'::"WorkspaceRole"
END
WHERE "role_new" IS NULL;

ALTER TABLE "WorkspaceMember" ALTER COLUMN "role_new" SET DEFAULT 'USER';
ALTER TABLE "WorkspaceMember" ALTER COLUMN "role_new" SET NOT NULL;

ALTER TABLE "WorkspaceMember" DROP COLUMN IF EXISTS "role";
ALTER TABLE "WorkspaceMember" RENAME COLUMN "role_new" TO "role";

-- 4) Invites table
CREATE TABLE IF NOT EXISTS "UserInviteToken" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "workspaceId" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserInviteToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserInviteToken_tokenHash_key" ON "UserInviteToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "UserInviteToken_email_idx" ON "UserInviteToken"("email");
CREATE INDEX IF NOT EXISTS "UserInviteToken_workspaceId_idx" ON "UserInviteToken"("workspaceId");
CREATE INDEX IF NOT EXISTS "UserInviteToken_expiresAt_idx" ON "UserInviteToken"("expiresAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserInviteToken_workspaceId_fkey'
  ) THEN
    ALTER TABLE "UserInviteToken" ADD CONSTRAINT "UserInviteToken_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;
