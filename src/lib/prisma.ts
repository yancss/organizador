import { PrismaClient } from '@prisma/client'

import { getUserId } from './request-context'

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

function withAuditExtension(p: PrismaClient) {
  // Models we expect to have audit fields (createdById/updatedById)
  const AUDITED = new Set([
    'Workspace',
    'WorkspaceMember',
    'SalesOrder',
    'SalesOrderItem',
    'PurchaseOrder',
    'PurchaseOrderItem',
    'Client',
    'Product',
    'Inventory',
    'Purchase',
    'Consumption',
    'Recipe',
    'RecipeItem',
    'FinancialAccount',
    'FinancialCategory',
    'CostCenter',
    'FinancialEntry',
    'Delivery',
    'DeliveryItem',
    'Receivable',
    'Payment',
    'PaymentApplication',
    'Refund',
  ])

  const AUDITED_LC = new Set([...AUDITED].map((x) => x.toLowerCase()))

  // CRUD models we want to produce AuditEvent logs for.
  // Keep it aligned with what's relevant for the UI.
  const AUDIT_LOG_MODELS_LC = new Set([...AUDITED_LC])

  function extractUpdateValue(v: any) {
    // Prisma update syntax sometimes uses { set: X }
    if (v && typeof v === 'object' && 'set' in v) return (v as any).set
    return v
  }

  function isScalarLike(v: any) {
    return v == null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
  }

  function scalarToString(v: any): string | null {
    if (v == null) return null
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v)
    // Prisma Decimal (decimal.js) and friends
    if (typeof v === 'object' && typeof v.toString === 'function') return v.toString()
    return null
  }

  function isNumericString(s: string) {
    return /^-?\d+(\.\d+)?$/.test(s)
  }

  function inferScale(a: string | null, b: string | null) {
    const decimals = (s: string | null) => {
      if (!s) return 0
      const i = s.indexOf('.')
      return i === -1 ? 0 : s.length - i - 1
    }
    // cap to avoid insane precision in logs
    return Math.min(6, Math.max(decimals(a), decimals(b)))
  }

  function roundToScale(n: number, scale: number) {
    const f = Math.pow(10, scale)
    return Math.round((n + Number.EPSILON) * f) / f
  }

  function normalizeComparable(prev: any, next: any) {
    const a = scalarToString(prev)
    const b = scalarToString(next)

    // If both look numeric, compare rounded to the "natural" scale.
    if (a && b && isNumericString(a) && isNumericString(b)) {
      const scale = inferScale(a, b)
      const an = Number(a)
      const bn = Number(b)
      if (Number.isFinite(an) && Number.isFinite(bn)) {
        const ar = roundToScale(an, scale)
        const br = roundToScale(bn, scale)
        return { equal: ar === br, from: ar, to: br }
      }
    }

    // fallback: strict equality on stringified scalar
    if (a != null && b != null) return { equal: a === b, from: a, to: b }

    return { equal: prev === next, from: prev ?? null, to: next ?? null }
  }

  function buildChanges(data: any, opts: { before?: any | null; strict?: boolean }) {
    // strict=true: only include keys where before is known and changed
    const before = opts.before ?? null
    const strict = opts.strict === true

    if (!data || typeof data !== 'object') return null

    const changes: Record<string, { from: any; to: any }> = {}

    // noisy/technical fields we don't want in audit logs
    const IGNORE_KEYS = new Set(['updatedById', 'createdById', 'orderIndex'])

    for (const [k, raw] of Object.entries(data)) {
      if (IGNORE_KEYS.has(k)) continue

      const v = extractUpdateValue(raw)
      if (v === undefined) continue
      if (!isScalarLike(v)) continue

      const hasBefore = before && Object.prototype.hasOwnProperty.call(before, k)
      const prev = hasBefore ? before[k] : undefined

      if (strict) {
        if (!hasBefore) continue
        const cmp = normalizeComparable(prev, v)
        if (cmp.equal) continue
        changes[k] = { from: cmp.from ?? null, to: cmp.to }
        continue
      }

      // non-strict: best effort
      if (hasBefore) {
        const cmp = normalizeComparable(prev, v)
        if (cmp.equal) continue
        changes[k] = { from: cmp.from ?? null, to: cmp.to }
      } else {
        // If we don't know before, avoid noisy nulls.
        if (v == null) continue
        changes[k] = { from: null, to: v }
      }
    }

    return Object.keys(changes).length ? changes : null
  }

  function extractWhereScalar(v: any) {
    // Prisma filters can come as scalar or as { equals: scalar }
    if (v && typeof v === 'object' && 'equals' in v) return (v as any).equals
    return v
  }

  function extractWorkspaceId(where: any): string | undefined {
    if (!where || typeof where !== 'object') return undefined
    const direct = extractWhereScalar((where as any).workspaceId)
    if (typeof direct === 'string' && direct) return direct

    const andArr = (where as any).AND
    if (Array.isArray(andArr)) {
      for (const part of andArr) {
        const got = extractWorkspaceId(part)
        if (got) return got
      }
    }

    return undefined
  }

  function extractEntityId(where: any): string | null {
    if (!where || typeof where !== 'object') return null
    const direct = extractWhereScalar((where as any).id)
    if (typeof direct === 'string' && direct) return direct

    const andArr = (where as any).AND
    if (Array.isArray(andArr)) {
      for (const part of andArr) {
        const got = extractEntityId(part)
        if (got) return got
      }
    }

    return null
  }

  // Prisma v6: prefer query extensions over middleware ($use is removed from types).
  return p.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const userId = getUserId()

          const modelName = model ? String(model) : ''
          const modelLc = modelName.toLowerCase()
          const modelEntityType = modelName ? modelName[0].toUpperCase() + modelName.slice(1) : modelName

          if (process.env.NODE_ENV !== 'production' && modelName) {
            // eslint-disable-next-line no-console
            console.log('[prisma] op', { model: modelName, operation })
          }

          // 1) createdById/updatedById policy
          if (userId && modelName && AUDITED_LC.has(modelLc)) {
            // Helper to set fields only when data is an object
            const setFields = (data: any, kind: 'create' | 'update') => {
              if (!data || typeof data !== 'object') return
              if (kind === 'create') {
                if (data.createdById === undefined) data.createdById = userId
                if (data.updatedById === undefined) data.updatedById = userId
              } else {
                data.updatedById = userId
              }
            }

            if (operation === 'create') {
              setFields((args as any)?.data, 'create')
            }

            if (operation === 'createMany') {
              const rows = (args as any)?.data
              if (Array.isArray(rows)) {
                for (const r of rows) setFields(r, 'create')
              } else {
                setFields(rows, 'create')
              }
            }

            if (operation === 'update' || operation === 'updateMany') {
              setFields((args as any)?.data, 'update')
            }

            if (operation === 'upsert') {
              setFields((args as any)?.create, 'create')
              setFields((args as any)?.update, 'update')
            }
          }

          // 2) AuditEvent logs for CRUD updates.
          // Prefer request-context user id, but fall back to args.data.{createdById,updatedById}
          // because some flows use updateMany with explicit updatedById.
          const actorFromArgs = (() => {
            const data = (args as any)?.data
            if (data && typeof data === 'object') {
              return (data.updatedById ?? data.createdById ?? null) as string | null
            }
            return null
          })()

          const actorUserId = (userId ?? actorFromArgs) as string | null

          const shouldLog = Boolean(modelName && AUDIT_LOG_MODELS_LC.has(modelLc))

          if (shouldLog && process.env.NODE_ENV !== 'production') {
            // eslint-disable-next-line no-console
            console.log('[audit] op', { model: modelName, operation, actorUserId: actorUserId ?? null })
          }

          let before: any | null = null
          let changeKeys: string[] = []

          if (shouldLog && operation === 'update') {
            const data = (args as any)?.data
            if (data && typeof data === 'object') {
              changeKeys = Object.keys(data)
                // ignore relational ops and special Prisma operators
                .filter((k) => !k.startsWith('_'))
            }

            // Fetch current values for the fields that are being updated.
            // If we can't infer a safe select, we skip before-values.
            if (changeKeys.length > 0) {
              const select: Record<string, boolean> = { id: true, workspaceId: true }
              for (const k of changeKeys) select[k] = true

              try {
                before = await (p as any)[model].findUnique({
                  where: (args as any)?.where,
                  select,
                })
              } catch {
                before = null
              }
            }
          }

          const result = await query(args)

          if (!shouldLog) return result

          try {
            // Single-record ops
            if (operation === 'create' || operation === 'update' || operation === 'delete') {
              const r: any = result

              // Resolve workspaceId
              const workspaceId: string | undefined = r?.workspaceId ?? before?.workspaceId

              if (!workspaceId) return result

              const entityId: string | undefined = r?.id ?? before?.id

              let action: 'CREATE' | 'UPDATE' | 'DELETE' = 'UPDATE'
              if (operation === 'create') action = 'CREATE'
              if (operation === 'delete') action = 'DELETE'

              let changesObj: Record<string, { from: any; to: any }> | null = null

              if (operation === 'create') {
                // Minimal: only mark as created (avoid noisy field dumps)
                changesObj = { created: { from: null, to: true } }
              }

              if (operation === 'update') {
                const data = (args as any)?.data
                changesObj = buildChanges(data, { before, strict: false })
                if (!changesObj) return result
              }

              if (operation === 'delete') {
                // Minimal: mark as deleted
                changesObj = { deleted: { from: null, to: true } }
              }

              const summary = `${action} ${modelName}${entityId ? `#${entityId}` : ''}`

              await p.auditEvent.create({
                data: {
                  workspaceId,
                  category: 'CRUD',
                  action,
                  actorUserId: actorUserId ?? null,
                  entityType: modelEntityType,
                  entityId: entityId ?? null,
                  summary,
                  ...(changesObj
                    ? {
                        changes: {
                          create: Object.entries(changesObj).map(([field, v]) => ({
                            field,
                            from: (v as any).from ?? null,
                            to: (v as any).to ?? null,
                          })),
                        },
                      }
                    : {}),
                },
              })
            }

            // Bulk ops (common in this codebase)
            if (operation === 'updateMany' || operation === 'deleteMany' || operation === 'createMany' || operation === 'upsert') {
              if (operation === 'updateMany') {
                const where = (args as any)?.where
                const data = (args as any)?.data

                // We only log when we can safely infer workspaceId from where.
                const workspaceId: string | undefined = extractWorkspaceId(where)
                if (!workspaceId) {
                  if (process.env.NODE_ENV !== 'production') {
                    // eslint-disable-next-line no-console
                    console.warn('[audit] skip updateMany: could not infer workspaceId', { model: modelName, where })
                  }
                  return result
                }

                // Best-effort entityId when updating a single known id.
                const entityId: string | null = extractEntityId(where)

                // If it looks like a single-record updateMany, fetch the current values first so we can log only real diffs.
                let beforeMany: any | null = null
                const keys = data && typeof data === 'object' ? Object.keys(data) : []
                const canBefore = Boolean(entityId && keys.length)

                if (canBefore) {
                  const select: Record<string, boolean> = { id: true, workspaceId: true }
                  for (const k of keys) select[k] = true

                  try {
                    beforeMany = await (p as any)[model].findFirst({
                      where,
                      select,
                    })
                  } catch {
                    beforeMany = null
                  }
                }

                let changes = buildChanges(data, { before: beforeMany, strict: Boolean(beforeMany) })

                // If strict diff produced nothing, fall back to non-strict best-effort.
                // This prevents missing logs when the "before" snapshot was incomplete or types differ (Decimal/enum).
                if (!changes) changes = buildChanges(data, { before: beforeMany, strict: false })

                // Still nothing meaningful → skip noisy audit rows.
                if (!changes) return result

                const count = (result as any)?.count
                const summary = `UPDATE_MANY ${modelName}${entityId ? `#${entityId}` : ''}${
                  typeof count === 'number' ? ` (${count})` : ''
                }`

                await p.auditEvent.create({
                  data: {
                    workspaceId,
                    category: 'CRUD',
                    action: 'UPDATE',
                    actorUserId: actorUserId ?? null,
                    entityType: modelEntityType,
                    entityId,
                    summary,
                    changes: {
                      create: Object.entries(changes).map(([field, v]) => ({
                        field,
                        from: (v as any).from ?? null,
                        to: (v as any).to ?? null,
                      })),
                    },
                    meta: { where },
                  },
                })
              }

              if (operation === 'deleteMany') {
                const where = (args as any)?.where

                const workspaceId: string | undefined = extractWorkspaceId(where)
                if (!workspaceId) {
                  if (process.env.NODE_ENV !== 'production') {
                    // eslint-disable-next-line no-console
                    console.warn('[audit] skip deleteMany: could not infer workspaceId', { model: modelName, where })
                  }
                  return result
                }

                const count = (result as any)?.count
                const summary = `DELETE_MANY ${modelName}${typeof count === 'number' ? ` (${count})` : ''}`

                await p.auditEvent.create({
                  data: {
                    workspaceId,
                    category: 'CRUD',
                    action: 'DELETE',
                    actorUserId: actorUserId ?? null,
                    entityType: modelEntityType,
                    entityId: null,
                    summary,
                    meta: { where },
                  },
                })
              }

              if (operation === 'createMany') {
                const data = (args as any)?.data

                const rows = Array.isArray(data) ? data : data ? [data] : []
                const workspaceId: string | undefined = rows[0]?.workspaceId
                if (!workspaceId) {
                  if (process.env.NODE_ENV !== 'production') {
                    // eslint-disable-next-line no-console
                    console.warn('[audit] skip createMany: could not infer workspaceId', { model: modelName })
                  }
                  return result
                }

                const count = (result as any)?.count
                const summary = `CREATE_MANY ${modelName}${typeof count === 'number' ? ` (${count})` : ''}`

                await p.auditEvent.create({
                  data: {
                    workspaceId,
                    category: 'CRUD',
                    action: 'CREATE',
                    actorUserId: actorUserId ?? null,
                    entityType: modelEntityType,
                    entityId: null,
                    summary,
                    meta: { count },
                  },
                })
              }

              if (operation === 'upsert') {
                // Best effort: log as UPDATE (since we don't know if it created without extra query)
                const where = (args as any)?.where
                const update = (args as any)?.update
                const create = (args as any)?.create

                // Try workspaceId in create payload first, then where
                const workspaceId: string | undefined = create?.workspaceId ?? extractWorkspaceId(where)
                if (!workspaceId) {
                  if (process.env.NODE_ENV !== 'production') {
                    // eslint-disable-next-line no-console
                    console.warn('[audit] skip upsert: could not infer workspaceId', { model: modelName, where })
                  }
                  return result
                }

                const entityId: string | null = extractEntityId(where)

                let changes: any = null
                const data = update && typeof update === 'object' ? update : create
                if (data && typeof data === 'object') {
                  changes = {}
                  for (const [k, raw] of Object.entries(data)) {
                    const v = extractUpdateValue(raw)
                    if (v === undefined) continue
                    if (v && typeof v === 'object') continue
                    changes[k] = { from: null, to: v }
                  }
                }

                const summary = `UPSERT ${modelName}${entityId ? `#${entityId}` : ''}`

                await p.auditEvent.create({
                  data: {
                    workspaceId,
                    category: 'CRUD',
                    action: 'UPDATE',
                    actorUserId: actorUserId ?? null,
                    entityType: modelEntityType,
                    entityId,
                    summary,
                    ...(changes
                      ? {
                          changes: {
                            create: Object.entries(changes).map(([field, v]) => ({
                              field,
                              from: (v as any).from ?? null,
                              to: (v as any).to ?? null,
                            })),
                          },
                        }
                      : {}),
                    meta: { where },
                  },
                })
              }
            }
          } catch (e) {
            // Never break product flows due to audit logging.
            // But in dev, surface it to help diagnose missing migrations / env issues.
            if (process.env.NODE_ENV !== 'production') {
              // eslint-disable-next-line no-console
              console.error('[audit] failed to write AuditEvent', { model, operation, error: String((e as any)?.message ?? e) })
            }
          }

          return result
        },
      },
    },
  })
}

const _prisma = global.prisma ?? withAuditExtension(new PrismaClient())

// We intentionally export it as PrismaClient to avoid extension type propagation across the codebase.
export const prisma: PrismaClient = _prisma as unknown as PrismaClient

if (process.env.NODE_ENV !== 'production') global.prisma = prisma
