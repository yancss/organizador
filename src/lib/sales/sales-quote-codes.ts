import { prisma } from '@/lib/prisma'

const SEQ_KEY = 'salesQuote'

export function formatSalesQuoteCode(n: number): string {
  const v = Math.max(1, Math.floor(Number(n) || 0))
  return `QUO-${String(v).padStart(10, '0')}`
}

export async function nextSalesQuoteCode(workspaceId: string): Promise<string> {
  const rows = (await prisma.$queryRaw`
    INSERT INTO "WorkspaceSequence" ("workspaceId", "key", "next")
    VALUES (${workspaceId}, ${SEQ_KEY}, 1)
    ON CONFLICT ("workspaceId", "key") DO UPDATE
      SET "next" = "WorkspaceSequence"."next" + 1
    RETURNING "next";
  `) as Array<{ next: number }>

  return formatSalesQuoteCode(rows?.[0]?.next)
}
