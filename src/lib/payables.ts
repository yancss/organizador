import { prisma } from '@/lib/prisma'

export async function upsertPayableForPurchaseOrder(args: {
  workspaceId: string
  purchaseOrderId: string
  supplierId?: string | null
  competenceDate: Date
  plannedAmount: number
  accruedAmount?: number
  receivedAt?: Date | null
  observations?: string | null
}) {
  const existing = await prisma.payable.findUnique({
    where: { purchaseOrderId: args.purchaseOrderId },
    select: { id: true, paidAmount: true, status: true, paidAt: true },
  })

  const accruedAmount = Math.max(0, Number(args.accruedAmount ?? 0))
  const plannedAmount = Math.max(0, Number(args.plannedAmount ?? 0))
  const paidAmount = Number(existing?.paidAmount ?? 0)
  const nextStatus =
    existing?.status === 'PAID'
      ? 'PAID'
      : accruedAmount > 0
        ? 'ACCRUED'
        : 'PLANNED'

  if (existing) {
    return prisma.payable.update({
      where: { id: existing.id },
      data: {
        supplierId: args.supplierId ?? null,
        competenceDate: args.competenceDate,
        plannedAmount,
        accruedAmount,
        paidAmount,
        receivedAt: args.receivedAt ?? null,
        paidAt: nextStatus === 'PAID' ? existing.paidAt : null,
        status: nextStatus,
        observations: args.observations ?? null,
      },
      select: { id: true },
    })
  }

  return prisma.payable.create({
    data: {
      workspaceId: args.workspaceId,
      purchaseOrderId: args.purchaseOrderId,
      supplierId: args.supplierId ?? null,
      competenceDate: args.competenceDate,
      plannedAmount,
      accruedAmount,
      paidAmount: 0,
      receivedAt: args.receivedAt ?? null,
      status: accruedAmount > 0 ? 'ACCRUED' : 'PLANNED',
      observations: args.observations ?? null,
    },
    select: { id: true },
  })
}

export async function cancelPayableForPurchaseOrder(workspaceId: string, purchaseOrderId: string) {
  const existing = await prisma.payable.findUnique({
    where: { purchaseOrderId },
    select: { id: true, status: true },
  })
  if (!existing || existing.status === 'PAID') return

  await prisma.payable.update({
    where: { id: existing.id },
    data: { status: 'CANCELLED' },
  })
}
