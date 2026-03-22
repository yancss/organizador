import { prisma } from '@/lib/prisma'

export const AUDIT_RETENTION_KEY = 'audit.retentionMonths'

export type AuditRetentionMonths = 3 | 6 | 12

export async function getAuditRetentionMonths(workspaceId: string): Promise<AuditRetentionMonths> {
  const row = await prisma.workspaceSetting.findUnique({
    where: { workspaceId_key: { workspaceId, key: AUDIT_RETENTION_KEY } },
    select: { value: true },
  })

  const n = Number((row?.value as unknown) ?? 3)
  return n === 6 || n === 12 ? n : 3
}

export function retentionMonthsToCutoff(months: AuditRetentionMonths, now = new Date()) {
  const d = new Date(now)
  d.setMonth(d.getMonth() - months)
  return d
}
