import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'

type AuditChangeInput = {
  field: string
  from: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | null
  to: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | null
}

export type AuditLogPayload = {
  workspaceId: string
  category: 'CRUD' | 'PERMISSIONS' | 'AUTH'
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'GRANT' | 'REVOKE'
  actorUserId?: string | null
  targetUserId?: string | null
  entityType?: string | null
  entityId?: string | null
  summary?: string | null
  meta?: Prisma.InputJsonValue | null
  changes?: AuditChangeInput[] | null
}

function getAuditOutboxMaxAttempts() {
  const raw = Number(process.env.AUDIT_OUTBOX_MAX_ATTEMPTS ?? 5)
  if (!Number.isFinite(raw) || raw <= 0) return 5
  return Math.min(10, Math.floor(raw))
}

function getAuditOutboxBatchSize() {
  const raw = Number(process.env.AUDIT_OUTBOX_BATCH_SIZE ?? 50)
  if (!Number.isFinite(raw) || raw <= 0) return 50
  return Math.min(200, Math.floor(raw))
}

function getAuditOutboxBackoffMs(attempt: number) {
  const baseMs = Number(process.env.AUDIT_OUTBOX_RETRY_BASE_MS ?? 10_000)
  const safeBase = Number.isFinite(baseMs) && baseMs > 0 ? baseMs : 10_000
  const exponent = Math.max(0, Math.min(5, attempt - 1))
  return safeBase * Math.pow(2, exponent)
}

function isAuditOutboxUnavailableError(err: unknown) {
  const message = String((err as any)?.message ?? err ?? '')
  const code = String((err as any)?.code ?? '')
  return (
    code === 'P2021' ||
    code === 'P2022' ||
    message.includes('AuditOutbox') ||
    message.includes('does not exist') ||
    message.includes('does not contain')
  )
}

function normalizePayload(payload: AuditLogPayload): Prisma.InputJsonValue {
  return {
    workspaceId: payload.workspaceId,
    category: payload.category,
    action: payload.action,
    actorUserId: payload.actorUserId ?? null,
    targetUserId: payload.targetUserId ?? null,
    entityType: payload.entityType ?? null,
    entityId: payload.entityId ?? null,
    summary: payload.summary ?? null,
    meta: payload.meta ?? null,
    changes: payload.changes
      ? payload.changes.map((change) => ({
          field: change.field,
          from: change.from ?? null,
          to: change.to ?? null,
        }))
      : null,
  } as unknown as Prisma.InputJsonValue
}

async function writeAuditEventDirect(payload: AuditLogPayload) {
  await prisma.auditEvent.create({
    data: {
      workspaceId: payload.workspaceId,
      category: payload.category,
      action: payload.action,
      actorUserId: payload.actorUserId ?? null,
      targetUserId: payload.targetUserId ?? null,
      entityType: payload.entityType ?? null,
      entityId: payload.entityId ?? null,
      summary: payload.summary ?? null,
      ...(payload.meta !== undefined ? { meta: payload.meta ?? Prisma.JsonNull } : {}),
      ...(payload.changes?.length
        ? {
            changes: {
              create: payload.changes.map((change) => ({
                field: change.field,
                from: change.from ?? Prisma.JsonNull,
                to: change.to ?? Prisma.JsonNull,
              })),
            },
          }
        : {}),
    },
  })
}

export async function enqueueAuditLog(payload: AuditLogPayload) {
  if (process.env.AUDIT_OUTBOX_FORCE_SYNC === '1') {
    await writeAuditEventDirect(payload)
    return { ok: true as const, mode: 'sync' as const }
  }

  try {
    await prisma.auditOutbox.create({
      data: {
        workspaceId: payload.workspaceId,
        payload: normalizePayload(payload),
      },
      select: { id: true },
    })

    return { ok: true as const, mode: 'queued' as const }
  } catch (err) {
    if (!isAuditOutboxUnavailableError(err)) throw err
    await writeAuditEventDirect(payload)
    return { ok: true as const, mode: 'sync-fallback' as const }
  }
}

export async function processAuditOutbox() {
  const now = new Date()
  const staleLockCutoff = new Date(now.getTime() - 1000 * 60 * 5)
  const maxAttempts = getAuditOutboxMaxAttempts()
  const batchSize = getAuditOutboxBatchSize()

  const jobs = await prisma.auditOutbox.findMany({
    where: {
      status: { in: ['PENDING', 'FAILED'] },
      availableAt: { lte: now },
      attempts: { lt: maxAttempts },
      OR: [{ lockedAt: null }, { lockedAt: { lt: staleLockCutoff } }],
    },
    orderBy: [{ availableAt: 'asc' }, { createdAt: 'asc' }],
    take: batchSize,
  })

  const result = {
    scanned: jobs.length,
    claimed: 0,
    processed: 0,
    retried: 0,
    failed: 0,
    skipped: 0,
  }

  for (const job of jobs) {
    const claim = await prisma.auditOutbox.updateMany({
      where: {
        id: job.id,
        status: job.status,
        OR: [{ lockedAt: null }, { lockedAt: { lt: staleLockCutoff } }],
      },
      data: {
        status: 'PROCESSING',
        lockedAt: now,
        lastError: null,
      },
    })

    if (claim.count === 0) {
      result.skipped += 1
      continue
    }

    result.claimed += 1

    try {
      const payload = job.payload as unknown as AuditLogPayload
      await writeAuditEventDirect(payload)
      await prisma.auditOutbox.delete({ where: { id: job.id } })
      result.processed += 1
    } catch (err) {
      const nextAttempts = job.attempts + 1
      const exhausted = nextAttempts >= maxAttempts

      await prisma.auditOutbox.update({
        where: { id: job.id },
        data: {
          status: exhausted ? 'FAILED' : 'PENDING',
          attempts: { increment: 1 },
          lockedAt: null,
          lastError: String((err as any)?.message ?? err ?? 'UNKNOWN_ERROR').slice(0, 2000),
          availableAt: exhausted ? now : new Date(now.getTime() + getAuditOutboxBackoffMs(nextAttempts)),
        },
      })

      if (exhausted) result.failed += 1
      else result.retried += 1
    }
  }

  return result
}
