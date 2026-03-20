-- Add sequential FIN code for FinancialEntry

-- WorkspaceSequence table
CREATE TABLE IF NOT EXISTS "WorkspaceSequence" (
  "workspaceId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "next" INTEGER NOT NULL,
  CONSTRAINT "WorkspaceSequence_pkey" PRIMARY KEY ("workspaceId", "key"),
  CONSTRAINT "WorkspaceSequence_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "WorkspaceSequence_workspaceId_idx" ON "WorkspaceSequence"("workspaceId");

-- FinancialEntry.code
ALTER TABLE "FinancialEntry"
  ADD COLUMN IF NOT EXISTS "code" VARCHAR(16);

-- Uniqueness per workspace (NULL codes are allowed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'FinancialEntry_workspaceId_code_key'
  ) THEN
    CREATE UNIQUE INDEX "FinancialEntry_workspaceId_code_key" ON "FinancialEntry"("workspaceId", "code");
  END IF;
END $$;
