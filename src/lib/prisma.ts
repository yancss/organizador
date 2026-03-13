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

  // Prisma v6: prefer query extensions over middleware ($use is removed from types).
  return p.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const userId = getUserId()

          if (!userId || !model || !AUDITED.has(model)) {
            return query(args)
          }

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

          return query(args)
        },
      },
    },
  })
}

const _prisma = global.prisma ?? withAuditExtension(new PrismaClient())

// We intentionally export it as PrismaClient to avoid extension type propagation across the codebase.
export const prisma: PrismaClient = _prisma as unknown as PrismaClient

if (process.env.NODE_ENV !== 'production') global.prisma = prisma
