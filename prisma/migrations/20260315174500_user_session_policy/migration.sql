-- Per-user session policy (JWT)
-- Adds optional override for session max age and a policy version for forced logout.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sessionMaxAgeSec" INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sessionPolicyVersion" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "User_sessionPolicyVersion_idx" ON "User"("sessionPolicyVersion");
