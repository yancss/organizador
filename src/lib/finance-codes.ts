import { prisma } from '@/lib/prisma'

const SEQ_KEY = 'financialEntry'

export function formatFinCode(n: number): string {
  const v = Math.max(1, Math.floor(Number(n) || 0))
  return `FIN-${String(v).padStart(10, '0')}`
}

export async function nextFinancialEntryCode(workspaceId: string): Promise<string> {
  // Atomic counter per workspace using INSERT..ON CONFLICT..DO UPDATE .. RETURNING
  const rows = (await prisma.$queryRaw`
    INSERT INTO "WorkspaceSequence" ("workspaceId", "key", "next")
    VALUES (${workspaceId}, ${SEQ_KEY}, 1)
    ON CONFLICT ("workspaceId", "key") DO UPDATE
      SET "next" = "WorkspaceSequence"."next" + 1
    RETURNING "next";
  `) as Array<{ next: number }>

  const next = rows?.[0]?.next
  return formatFinCode(next)
}
