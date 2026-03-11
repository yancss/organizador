import { prisma } from '@/lib/prisma'

function sumApplied(apps: Array<{ value: unknown }>) {
  return apps.reduce((acc, a) => acc + Number(a.value ?? 0), 0)
}

export async function applyAvailablePaymentsToReceivable(args: {
  workspaceId: string
  salesOrderId: string
  receivableId: string
}) {
  const { workspaceId, salesOrderId, receivableId } = args

  const rec = await prisma.receivable.findFirst({
    where: { id: receivableId, workspaceId, salesOrderId },
    select: {
      id: true,
      value: true,
      status: true,
      applications: { select: { id: true, value: true } },
    },
  })
  if (!rec) return { ok: false as const, error: 'RECEIVABLE_NOT_FOUND' }
  if (rec.status !== 'OPEN') return { ok: true as const, applied: 0 }

  const alreadyApplied = sumApplied(rec.applications)
  const remaining = Number(rec.value) - alreadyApplied
  if (remaining <= 0) {
    // already fully covered by existing applications
    await prisma.receivable.update({ where: { id: rec.id }, data: { status: 'PAID' } })
    return { ok: true as const, applied: 0 }
  }

  const payments = await prisma.payment.findMany({
    where: { workspaceId, salesOrderId, status: 'RECEIVED' },
    orderBy: [{ receivedAt: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      value: true,
      applications: { select: { value: true } },
    },
  })

  let totalAppliedNow = 0

  for (const p of payments) {
    const pApplied = sumApplied(p.applications)
    const pRemaining = Number(p.value) - pApplied
    if (pRemaining <= 0) continue

    const need = remaining - totalAppliedNow
    if (need <= 0) break

    const toApply = Math.min(pRemaining, need)
    if (toApply <= 0) continue

    await prisma.paymentApplication.create({
      data: {
        workspaceId,
        paymentId: p.id,
        receivableId: rec.id,
        value: toApply,
      },
      select: { id: true },
    })

    totalAppliedNow += toApply
  }

  // refresh paid status
  const after = await prisma.receivable.findFirst({
    where: { id: rec.id },
    select: { id: true, value: true, status: true, applications: { select: { value: true } } },
  })
  if (after && after.status === 'OPEN') {
    const a = sumApplied(after.applications)
    if (a >= Number(after.value)) {
      await prisma.receivable.update({ where: { id: after.id }, data: { status: 'PAID' } })
    }
  }

  return { ok: true as const, applied: totalAppliedNow }
}

export async function createReceivableForDeliveryOnShipped(args: {
  workspaceId: string
  deliveryId: string
}) {
  const { workspaceId, deliveryId } = args

  const del = await prisma.delivery.findFirst({
    where: { id: deliveryId, workspaceId },
    select: {
      id: true,
      status: true,
      shippedAt: true,
      value: true,
      salesOrderId: true,
      clientId: true,
      receivable: { select: { id: true } },
      salesOrder: { select: { id: true } },
    },
  })

  if (!del) return { ok: false as const, error: 'DELIVERY_NOT_FOUND' }
  if (del.status !== 'SHIPPED') return { ok: false as const, error: 'DELIVERY_NOT_SHIPPED' }
  if (del.receivable) return { ok: true as const, receivableId: del.receivable.id, created: false }

  const v = Number(del.value ?? 0)
  if (v <= 0) return { ok: false as const, error: 'DELIVERY_VALUE_REQUIRED' }

  const rec = await prisma.receivable.create({
    data: {
      workspaceId,
      salesOrderId: del.salesOrderId,
      deliveryId: del.id,
      clientId: del.clientId ?? null,
      issuedAt: del.shippedAt ?? new Date(),
      dueAt: null,
      value: v,
      status: 'OPEN',
    },
    select: { id: true },
  })

  // apply prepayments linked to PV
  await applyAvailablePaymentsToReceivable({
    workspaceId,
    salesOrderId: del.salesOrderId,
    receivableId: rec.id,
  })

  return { ok: true as const, receivableId: rec.id, created: true }
}
