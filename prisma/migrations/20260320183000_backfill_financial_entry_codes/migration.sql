-- Backfill sequential FIN codes for existing FinancialEntry rows

-- 1) Assign codes per workspace, ordered by createdAt/id, only when code is NULL/empty
WITH ranked AS (
  SELECT
    e.id,
    e."workspaceId" AS workspace_id,
    ROW_NUMBER() OVER (PARTITION BY e."workspaceId" ORDER BY e."createdAt" ASC, e.id ASC) AS rn
  FROM "FinancialEntry" e
  WHERE e."code" IS NULL OR trim(e."code") = ''
)
UPDATE "FinancialEntry" e
SET "code" = 'FIN-' || LPAD(r.rn::text, 10, '0')
FROM ranked r
WHERE e.id = r.id;

-- 2) Update WorkspaceSequence.next so new entries continue after the max existing rn
INSERT INTO "WorkspaceSequence" ("workspaceId", "key", "next")
SELECT
  e."workspaceId",
  'financialEntry' AS key,
  (MAX(CAST(SUBSTRING(e."code" FROM 5) AS INT)) + 1) AS next
FROM "FinancialEntry" e
WHERE e."code" LIKE 'FIN-%'
GROUP BY e."workspaceId"
ON CONFLICT ("workspaceId", "key") DO UPDATE
SET "next" = GREATEST("WorkspaceSequence"."next", EXCLUDED."next");
