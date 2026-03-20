-- Add workspaceRole to user invite tokens so we can assign role on accept
ALTER TABLE "UserInviteToken"
ADD COLUMN     "workspaceRole" "WorkspaceRole" NOT NULL DEFAULT 'USER';

-- (optional) index is already on workspaceId/email/expiresAt; no changes needed
