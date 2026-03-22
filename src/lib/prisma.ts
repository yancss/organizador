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

  // CRUD models we want to produce AuditEvent logs for.
  // Keep it aligned with what's relevant for the UI.
  const AUDIT_LOG_MODELS = new Set([...AUDITED])

  function extractUpdateValue(v: any) {
    // Prisma update syntax sometimes uses { set: X }
    if (v && typeof v === 'object' && 'set' in v) return (v as any).set
    return v
  }

  // Prisma v6: prefer query extensions over middleware ($use is removed from types).
  return p.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const userId = getUserId()

          // 1) createdById/updatedById policy
          if (userId && model && AUDITED.has(model)) {
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
          // We only do it when we have a request user in context.
          const shouldLog = Boolean(userId && model && AUDIT_LOG_MODELS.has(model))

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
            // We only log for single-record ops; bulk ops can be added later.
            if (operation === 'create' || operation === 'update' || operation === 'delete') {
              const r: any = result

              // Resolve workspaceId
              const workspaceId: string | undefined = r?.workspaceId ?? before?.workspaceId

              if (!workspaceId) return result

              const entityId: string | undefined = r?.id ?? before?.id

              let action: 'CREATE' | 'UPDATE' | 'DELETE' = 'UPDATE'
              if (operation === 'create') action = 'CREATE'
              if (operation === 'delete') action = 'DELETE'

              let changes: any = null

              if (operation === 'create') {
                // Only keep scalar-ish values (skip objects)
                const data = (args as any)?.data
                if (data && typeof data === 'object') {
                  changes = {}
                  for (const [k, raw] of Object.entries(data)) {
                    const v = extractUpdateValue(raw)
                    if (v === undefined) continue
                    if (v && typeof v === 'object') continue
                    changes[k] = { from: null, to: v }
                  }
                }
              }

              if (operation === 'update') {
                const data = (args as any)?.data
                if (data && typeof data === 'object') {
                  changes = {}
                  for (const [k, raw] of Object.entries(data)) {
                    const v = extractUpdateValue(raw)
                    if (v === undefined) continue
                    if (v && typeof v === 'object') continue
                    const prev = before ? before[k] : undefined
                    // If we don't know before, still log the new value.
                    if (before && prev === v) continue
                    changes[k] = { from: before ? prev ?? null : null, to: v }
                  }
                }
              }

              if (operation === 'delete') {
                // For delete, keep a small snapshot (id + any obvious label fields)
                changes = {}
                const labelKeys = ['name', 'code', 'email']
                for (const k of labelKeys) {
                  const v = r?.[k]
                  if (v != null && (typeof v === 'string' || typeof v === 'number')) {
                    changes[k] = { from: v, to: null }
                  }
                }
              }

              const summary = `${action} ${model}${entityId ? `#${entityId}` : ''}`

              await p.auditEvent.create({
                data: {
                  workspaceId,
                  category: 'CRUD',
                  action,
                  actorUserId: userId ?? null,
                  entityType: model,
                  entityId: entityId ?? null,
                  summary,
                  changes: changes ?? null,
                },
              })
            }
          } catch {
            // Never break product flows due to audit logging.
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
