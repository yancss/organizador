import { PrismaClient } from '@prisma/client'

import { getUserId } from './request-context'

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

function withAuditMiddleware(p: PrismaClient) {
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

  p.$use(async (params, next) => {
    const userId = getUserId()

    if (!userId || !params.model || !AUDITED.has(params.model)) {
      return next(params)
    }

    const action = params.action

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

    if (action === 'create') {
      setFields(params.args?.data, 'create')
    }

    if (action === 'createMany') {
      const rows = params.args?.data
      if (Array.isArray(rows)) {
        for (const r of rows) setFields(r, 'create')
      } else {
        setFields(rows, 'create')
      }
    }

    if (action === 'update' || action === 'updateMany') {
      setFields(params.args?.data, 'update')
    }

    if (action === 'upsert') {
      setFields(params.args?.create, 'create')
      setFields(params.args?.update, 'update')
    }

    return next(params)
  })

  return p
}

export const prisma = global.prisma ?? withAuditMiddleware(new PrismaClient())

if (process.env.NODE_ENV !== 'production') global.prisma = prisma
