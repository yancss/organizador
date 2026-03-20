-- Add FinancialEntry.name (human-friendly title)

ALTER TABLE "FinancialEntry"
  ADD COLUMN IF NOT EXISTS "name" VARCHAR(200);

-- Backfill: if name is empty, use observations when it looks like a REF
UPDATE "FinancialEntry"
SET "name" = "observations"
WHERE ("name" IS NULL OR trim("name") = '')
  AND "observations" IS NOT NULL
  AND "observations" LIKE 'REF:%';
