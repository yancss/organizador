import { NextRequest } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'
import { adjustInventory } from '@/lib/inventory-movements'
import { registerInventoryLotReceipt } from '@/lib/inventory-lots'
import { upsertPayableForPurchaseOrder as upsertDedicatedPayable } from '@/lib/payables'
import { ensureDefaultWarehouse } from '@/lib/stock-locations'

const BodySchema = z.object({
  dryRun: z.coerce.boolean().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.coerce.number().positive(),
        acceptedQty: z.coerce.number().min(0).optional(),
        rejectedQty: z.coerce.number().min(0).optional(),
        lotCode: z.string().max(120).optional().nullable(),
        expiresAt: z.string().datetime().optional().nullable(),
        serialCodes: z.array(z.string().max(160)).optional(),
        observation: z.string().max(2000).optional().nullable(),
      }),
    )
    .optional(),
})

function summarizeReceiptPlan(
  po: {
    estimatedCost: number | null
    items: Array<{
      productId: string
      productName: string
      unit: string
      quantity: number
      receivedQty: number
      acceptedQty: number
      rejectedQty: number
      pendingQty: number
      receiptObservation: string | null
    }>
  },
  receivePlan: Array<{
    productId: string
    acceptedQty: number
    rejectedQty: number
    receiveQty: number
    lotCode: string | null
    expiresAt: string | null
    observation: string | null
  }>,
  requestedByProduct: Map<string, { receiveQty: number; acceptedQty?: number; rejectedQty?: number; lotCode?: string | null; expiresAt?: string | null; observation?: string | null }>,
  pendingBefore: number,
  pendingAfter: number,
) {
  const planByProduct = new Map(receivePlan.map((item) => [item.productId, item]))
  const items = po.items.map((it) => {
    const plan = planByProduct.get(it.productId)
    const receiveQty = requestedByProduct.get(it.productId)?.receiveQty ?? 0
    const receiveAcceptedQty = plan?.acceptedQty ?? 0
    const receiveRejectedQty = plan?.rejectedQty ?? 0
    const nextReceivedQty = it.receivedQty + receiveQty
    const nextAcceptedQty = it.acceptedQty + receiveAcceptedQty
    const nextRejectedQty = it.rejectedQty + receiveRejectedQty
    const nextPendingQty = Math.max(0, it.quantity - nextReceivedQty)
    const willHaveDivergence = nextRejectedQty > 0.000001
    const hasExcessNow = receiveQty > it.pendingQty + 0.000001
    const hasRejectionNow = receiveRejectedQty > 0.000001
    const divergenceType = hasExcessNow ? 'EXCESS' : hasRejectionNow ? 'REJECTED' : willHaveDivergence ? 'HISTORY' : 'NONE'

    return {
      productId: it.productId,
      productName: it.productName,
      unit: it.unit,
      orderedQty: it.quantity,
      receivedQty: it.receivedQty,
      acceptedQty: it.acceptedQty,
      rejectedQty: it.rejectedQty,
      pendingQty: it.pendingQty,
      receiveQty,
      receiveAcceptedQty,
      receiveRejectedQty,
      nextReceivedQty,
      nextAcceptedQty,
      nextRejectedQty,
      nextPendingQty,
      divergenceType,
      hasExcessNow,
      hasRejectionNow,
      willHaveDivergence,
      lotCode: plan?.lotCode ?? null,
      expiresAt: plan?.expiresAt ?? null,
      observation: plan?.observation ?? it.receiptObservation ?? null,
    }
  })

  return {
    distinctItems: po.items.length,
    totalUnits: po.items.reduce((acc, it) => acc + it.quantity, 0),
    pendingUnitsBefore: pendingBefore,
    receivingUnitsNow: receivePlan.reduce((acc, it) => acc + it.receiveQty, 0),
    pendingUnitsAfter: pendingAfter,
    estimatedCost: po.estimatedCost,
    divergentItemsNow: items.filter((item) => item.hasExcessNow || item.hasRejectionNow).length,
    divergentItemsTotal: items.filter((item) => item.willHaveDivergence).length,
    fullyReceived: pendingAfter <= 0.000001,
    items,
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  const { id } = await ctx.params

  const body = await req.json().catch(() => ({}))
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  const dryRun = parsed.data.dryRun ?? false

  let result
  try {
    result = await prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findFirst({
      where: { id, workspaceId: wsId },
      select: {
        id: true,
        status: true,
        supplierId: true,
        receivedAt: true,
        orderedAt: true,
        estimatedCost: true,
        items: {
          select: {
            productId: true,
            quantity: true,
            receivedQty: true,
            acceptedQty: true,
            rejectedQty: true,
            receiptObservation: true,
            unitCost: true,
            product: { select: { id: true, name: true, unit: true } },
          },
        },
      },
    })
    if (!po) throw new Error('NOT_FOUND')
    if (po.status === 'CANCELLED') throw new Error('CANNOT_RECEIVE_CANCELLED')

    const itemByProduct = new Map(
      po.items.map((it) => [
        it.productId,
        {
          productId: it.productId,
          productName: it.product.name,
          unit: it.product.unit,
          quantity: Number(it.quantity),
          receivedQty: Number(it.receivedQty ?? 0),
          acceptedQty: Number(it.acceptedQty ?? 0),
          rejectedQty: Number(it.rejectedQty ?? 0),
          receiptObservation: it.receiptObservation ?? null,
          unitCost: it.unitCost == null ? null : Number(it.unitCost),
        },
      ]),
    )

    const pendingItems = Array.from(itemByProduct.values()).map((it) => ({
      ...it,
      pendingQty: Math.max(0, it.quantity - it.receivedQty),
    }))

    const requested: Array<{
      productId: string
      quantity: number
      acceptedQty?: number
      rejectedQty?: number
      lotCode?: string | null
      expiresAt?: string | null
      serialCodes?: string[]
      observation?: string | null
    }> = parsed.data.items?.length
      ? parsed.data.items
      : pendingItems.filter((it) => it.pendingQty > 0).map((it) => ({ productId: it.productId, quantity: it.pendingQty }))

    const requestedByProduct = new Map<string, { receiveQty: number; acceptedQty?: number; rejectedQty?: number; lotCode?: string | null; expiresAt?: string | null; serialCodes?: string[]; observation?: string | null }>()
    for (const item of requested) {
      const prev = requestedByProduct.get(item.productId)
      const receiveQty = Number(item.quantity)
      const acceptedQty = item.acceptedQty == null ? undefined : Number(item.acceptedQty)
      const rejectedQty = item.rejectedQty == null ? undefined : Number(item.rejectedQty)
      const lotCode = item.lotCode?.trim() ? item.lotCode.trim() : null
      const expiresAt = item.expiresAt?.trim() ? item.expiresAt.trim() : null
      const serialCodes = [...new Set((item.serialCodes ?? []).map((entry) => entry.trim()).filter(Boolean))]
      const observation = item.observation?.trim() ? item.observation.trim() : null
      requestedByProduct.set(item.productId, {
        receiveQty: (prev?.receiveQty ?? 0) + receiveQty,
        acceptedQty: acceptedQty == null ? prev?.acceptedQty : (prev?.acceptedQty ?? 0) + acceptedQty,
        rejectedQty: rejectedQty == null ? prev?.rejectedQty : (prev?.rejectedQty ?? 0) + rejectedQty,
        lotCode: lotCode ?? prev?.lotCode ?? null,
        expiresAt: expiresAt ?? prev?.expiresAt ?? null,
        serialCodes: serialCodes.length ? serialCodes : (prev?.serialCodes ?? []),
        observation: observation ?? prev?.observation ?? null,
      })
    }

    let totalRequestedUnits = 0
    const receivePlan = pendingItems
      .map((it) => {
        const requestedItem = requestedByProduct.get(it.productId)
        const receiveQty = requestedItem?.receiveQty ?? 0
        const acceptedQtyInput = requestedItem?.acceptedQty
        const rejectedQtyInput = requestedItem?.rejectedQty
        const acceptedQty =
          acceptedQtyInput == null
            ? Math.max(0, receiveQty - (rejectedQtyInput ?? 0))
            : acceptedQtyInput
        const rejectedQty =
          rejectedQtyInput == null
            ? Math.max(0, receiveQty - acceptedQty)
            : rejectedQtyInput
        totalRequestedUnits += receiveQty
        return {
          ...it,
          receiveQty,
          acceptedQty,
          rejectedQty,
          lotCode: requestedItem?.lotCode ?? null,
          expiresAt: requestedItem?.expiresAt ?? null,
          serialCodes: requestedItem?.serialCodes ?? [],
          observation: requestedItem?.observation ?? null,
        }
      })
      .filter((it) => it.receiveQty > 0)

    if (!receivePlan.length) throw new Error('NOTHING_TO_RECEIVE')

    for (const it of receivePlan) {
      if (it.pendingQty <= 0) throw new Error('ITEM_ALREADY_FULLY_RECEIVED')
      if (!Number.isFinite(it.acceptedQty) || it.acceptedQty < 0) throw new Error('INVALID_ACCEPTED_QTY')
      if (!Number.isFinite(it.rejectedQty) || it.rejectedQty < 0) throw new Error('INVALID_REJECTED_QTY')
      if (Math.abs(it.receiveQty - (it.acceptedQty + it.rejectedQty)) > 0.000001) throw new Error('RECEIVE_BREAKDOWN_MISMATCH')
      if (it.acceptedQty > it.pendingQty + 0.000001) throw new Error('ACCEPT_QTY_EXCEEDS_PENDING')
      if (it.acceptedQty > 0 && (it.unitCost == null || !Number.isFinite(it.unitCost) || it.unitCost <= 0)) throw new Error('UNIT_COST_REQUIRED')
    }

    const totalPendingBefore = pendingItems.reduce((acc, it) => acc + it.pendingQty, 0)
    const totalPendingAfter = Math.max(0, totalPendingBefore - totalRequestedUnits)
    const willBeFullyReceived = totalPendingAfter <= 0.000001

    const summary = summarizeReceiptPlan(
      {
        estimatedCost: po.estimatedCost == null ? null : Number(po.estimatedCost),
        items: pendingItems,
      },
      receivePlan,
      requestedByProduct,
      totalPendingBefore,
      totalPendingAfter,
    )

    if (dryRun) {
      return { summary, purchaseOrder: null as any }
    }

    for (const it of receivePlan) {
      if (it.acceptedQty > 0) {
        const defaultWarehouse = await ensureDefaultWarehouse(tx as any, wsId, auth.user.id)
        const inv = await tx.inventory.findUnique({ where: { productId: it.productId }, select: { quantity: true } })
        const product = await tx.product.findFirst({ where: { id: it.productId, workspaceId: wsId }, select: { avgCost: true } })
        const currentQty = inv?.quantity == null ? 0 : Number(inv.quantity)
        const currentAvg = product?.avgCost == null ? 0 : Number(product.avgCost)

        await adjustInventory(tx as any, {
          workspaceId: wsId,
          productId: it.productId,
          delta: it.acceptedQty,
          userId: auth.user.id,
          movementType: 'PURCHASE_RECEIPT',
          referenceType: 'PurchaseOrder',
          referenceId: po.id,
          observations: it.observation ?? null,
          unitCost: Number(it.unitCost),
        })

        if (it.lotCode) {
          if ((it.serialCodes?.length ?? 0) > 0 && Math.abs(it.acceptedQty - (it.serialCodes?.length ?? 0)) > 0.000001) {
            throw new Error('SERIAL_COUNT_MISMATCH')
          }
          await registerInventoryLotReceipt(tx as any, {
            workspaceId: wsId,
            productId: it.productId,
            warehouseId: defaultWarehouse.id,
            purchaseOrderId: po.id,
            supplierId: po.supplierId ?? null,
            lotCode: it.lotCode,
            expiresAt: it.expiresAt ? new Date(it.expiresAt) : null,
            serialCodes: it.serialCodes ?? [],
            quantity: it.acceptedQty,
            notes: it.observation ?? null,
            userId: auth.user.id,
            eventType: 'PURCHASE_RECEIPT',
            referenceType: 'PurchaseOrder',
            referenceId: po.id,
          })
        }

        const denom = currentQty + it.acceptedQty
        const nextAvg = denom > 0 ? (currentQty * currentAvg + it.acceptedQty * Number(it.unitCost)) / denom : Number(it.unitCost)

        await tx.product.update({ where: { id: it.productId }, data: { avgCost: nextAvg } })
      }

      await tx.purchaseOrderItem.update({
        where: { purchaseOrderId_productId: { purchaseOrderId: po.id, productId: it.productId } },
        data: {
          receivedQty: { increment: it.receiveQty },
          acceptedQty: { increment: it.acceptedQty },
          rejectedQty: { increment: it.rejectedQty },
          receiptObservation: it.observation ?? undefined,
          updatedById: auth.user.id,
        },
      })
    }

    const updated = await tx.purchaseOrder.update({
      where: { id, workspaceId: wsId },
      data: {
        status: willBeFullyReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED',
        receivedAt: po.receivedAt ?? new Date(),
        updatedById: auth.user.id,
      },
      select: {
        id: true,
        status: true,
        receivedAt: true,
      },
    })

    return { summary, purchaseOrder: updated }
    })
  } catch (err: any) {
    const msg = String(err?.message ?? err)
    if (msg.includes('SERIAL_COUNT_MISMATCH')) return Response.json({ error: 'SERIAL_COUNT_MISMATCH' }, { status: 409 })
    throw err
  }

  if (result.purchaseOrder && result.summary.estimatedCost != null && result.summary.totalUnits > 0) {
    const receivedRatio =
      (result.summary.totalUnits - result.summary.pendingUnitsAfter) / result.summary.totalUnits
    await upsertDedicatedPayable({
      workspaceId: wsId,
      purchaseOrderId: id,
      competenceDate: new Date(),
      plannedAmount: result.summary.estimatedCost,
      accruedAmount: Number((result.summary.estimatedCost * receivedRatio).toFixed(2)),
      receivedAt: result.purchaseOrder.receivedAt ? new Date(result.purchaseOrder.receivedAt) : new Date(),
    })
  }

  return Response.json(result)
}
