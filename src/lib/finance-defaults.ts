import { prisma } from '@/lib/prisma'

export async function ensureDefaultBankAccount(workspaceId: string) {
  const existing = await prisma.financialAccount.findFirst({
    where: { workspaceId, active: true, kind: 'BANK' },
    orderBy: [{ createdAt: 'asc' }],
    select: { id: true, name: true },
  })
  if (existing) return existing

  return prisma.financialAccount.create({
    data: { workspaceId, name: 'Banco', kind: 'BANK', active: true },
    select: { id: true, name: true },
  })
}

export async function ensureDefaultCostCenter(workspaceId: string, name: string) {
  const existing = await prisma.costCenter.findFirst({
    where: { workspaceId, active: true, name },
    select: { id: true, name: true },
  })
  if (existing) return existing

  return prisma.costCenter.create({
    data: { workspaceId, name, active: true },
    select: { id: true, name: true },
  })
}

export async function ensureDefaultCategory(workspaceId: string, name: string, type: 'IN' | 'OUT') {
  const existing = await prisma.financialCategory.findFirst({
    where: { workspaceId, active: true, name, type },
    select: { id: true, name: true, type: true },
  })
  if (existing) return existing

  return prisma.financialCategory.create({
    data: { workspaceId, name, type, active: true },
    select: { id: true, name: true, type: true },
  })
}

export async function ensureFinanceDefaults(workspaceId: string) {
  const account = await ensureDefaultBankAccount(workspaceId)
  const ccSales = await ensureDefaultCostCenter(workspaceId, 'Vendas')
  const ccProd = await ensureDefaultCostCenter(workspaceId, 'Produção')
  const catSales = await ensureDefaultCategory(workspaceId, 'Vendas', 'IN')
  const catPurch = await ensureDefaultCategory(workspaceId, 'Compras/Insumos', 'OUT')

  return {
    accountId: account.id,
    costCenterSalesId: ccSales.id,
    costCenterProductionId: ccProd.id,
    categorySalesId: catSales.id,
    categoryPurchasesId: catPurch.id,
  }
}

export async function upsertReceivableForOrder(args: {
  workspaceId: string
  orderId: string
  competenceDate: Date
  value: number
}) {
  const defs = await ensureFinanceDefaults(args.workspaceId)

  const existing = await prisma.financialEntry.findFirst({
    where: { workspaceId: args.workspaceId, orderId: args.orderId, type: 'IN' },
    select: { id: true, status: true },
    orderBy: [{ createdAt: 'desc' }],
  })

  if (existing) {
    // If it was already PAID, keep it PAID (do not revert automatically).
    const status = existing.status === 'PAID' ? 'PAID' : 'PLANNED'
    return prisma.financialEntry.update({
      where: { id: existing.id, workspaceId: args.workspaceId },
      data: {
        competenceDate: args.competenceDate,
        value: args.value,
        status,
        accountId: defs.accountId,
        categoryId: defs.categorySalesId,
        costCenterId: defs.costCenterSalesId,
      },
      select: { id: true },
    })
  }

  return prisma.financialEntry.create({
    data: {
      workspaceId: args.workspaceId,
      type: 'IN',
      status: 'PLANNED',
      competenceDate: args.competenceDate,
      paidAt: null,
      value: args.value,
      accountId: defs.accountId,
      categoryId: defs.categorySalesId,
      costCenterId: defs.costCenterSalesId,
      orderId: args.orderId,
    },
    select: { id: true },
  })
}

export async function deletePlannedReceivableForOrder(workspaceId: string, orderId: string) {
  const existing = await prisma.financialEntry.findFirst({
    where: { workspaceId, orderId, type: 'IN', status: 'PLANNED' },
    select: { id: true },
    orderBy: [{ createdAt: 'desc' }],
  })
  if (!existing) return
  await prisma.financialEntry.delete({ where: { id: existing.id, workspaceId } })
}

export async function upsertPayableForPurchase(args: {
  workspaceId: string
  purchaseId: string
  competenceDate: Date
  value: number
  paid: boolean
}) {
  const defs = await ensureFinanceDefaults(args.workspaceId)

  const existing = await prisma.financialEntry.findFirst({
    where: { workspaceId: args.workspaceId, purchaseId: args.purchaseId, type: 'OUT' },
    select: { id: true },
    orderBy: [{ createdAt: 'desc' }],
  })

  const status = args.paid ? 'PAID' : 'PLANNED'
  const paidAt = args.paid ? args.competenceDate : null

  if (existing) {
    return prisma.financialEntry.update({
      where: { id: existing.id, workspaceId: args.workspaceId },
      data: {
        competenceDate: args.competenceDate,
        value: args.value,
        status,
        paidAt,
        accountId: defs.accountId,
        categoryId: defs.categoryPurchasesId,
        costCenterId: defs.costCenterProductionId,
      },
      select: { id: true },
    })
  }

  return prisma.financialEntry.create({
    data: {
      workspaceId: args.workspaceId,
      type: 'OUT',
      status,
      competenceDate: args.competenceDate,
      paidAt,
      value: args.value,
      accountId: defs.accountId,
      categoryId: defs.categoryPurchasesId,
      costCenterId: defs.costCenterProductionId,
      purchaseId: args.purchaseId,
    },
    select: { id: true },
  })
}
