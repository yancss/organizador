import { prisma } from '@/lib/prisma'
import { consumeInventoryLots, registerInventoryLotReceipt } from '@/lib/inventory-lots'
import { recordInventoryMovement } from '@/lib/inventory-ledger'

type Tx = Parameters<typeof prisma.$transaction>[0] extends (tx: infer T) => any ? T : never

function makeLocalId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`
}

export async function ensureDefaultWarehouse(tx: Tx, workspaceId: string, userId?: string | null) {
  const existing = await tx.warehouse.findFirst({
    where: { workspaceId, isDefault: true },
    select: { id: true, name: true, code: true },
  })
  if (existing) return existing

  return tx.warehouse.create({
    data: {
      id: makeLocalId('wh'),
      workspaceId,
      createdById: userId ?? null,
      updatedById: userId ?? null,
      name: 'Principal',
      code: 'MAIN',
      active: true,
      isDefault: true,
    },
    select: { id: true, name: true, code: true },
  })
}

export async function adjustDefaultWarehouseInventory(
  tx: Tx,
  args: {
    workspaceId: string
    productId: string
    delta: number
    userId?: string | null
    disallowNegative?: boolean
  },
) {
  const warehouse = await ensureDefaultWarehouse(tx, args.workspaceId, args.userId)
  const balance = await tx.inventoryByWarehouse.findUnique({
    where: { warehouseId_productId: { warehouseId: warehouse.id, productId: args.productId } },
    select: { id: true, quantity: true },
  })

  const nextQty = Number(balance?.quantity ?? 0) + args.delta
  if ((args.disallowNegative ?? true) && nextQty < -0.000001) throw new Error('INSUFFICIENT_STOCK')

  if (!balance) {
    const created = await tx.inventoryByWarehouse.create({
      data: {
        id: makeLocalId('iw'),
        workspaceId: args.workspaceId,
        warehouseId: warehouse.id,
        productId: args.productId,
        quantity: Math.max(0, args.delta),
      },
      select: { quantity: true },
    })
    if (args.delta < 0) throw new Error('INSUFFICIENT_STOCK')
    return {
      warehouseId: warehouse.id,
      warehouseName: warehouse.name,
      balanceAfterWarehouse: Number(created.quantity ?? 0),
    }
  }

  const updated = await tx.inventoryByWarehouse.update({
    where: { id: balance.id },
    data: { quantity: { increment: args.delta } },
    select: { quantity: true },
  })

  return {
    warehouseId: warehouse.id,
    warehouseName: warehouse.name,
    balanceAfterWarehouse: Number(updated.quantity ?? 0),
  }
}

export async function transferInventoryBetweenWarehouses(
  tx: Tx,
  args: {
    workspaceId: string
    productId: string
    fromWarehouseId: string
    toWarehouseId: string
    sourceLotId?: string | null
    quantity: number
    observations?: string | null
    userId?: string | null
  },
) {
  if (args.fromWarehouseId === args.toWarehouseId) throw new Error('TRANSFER_SAME_WAREHOUSE')
  if (!Number.isFinite(args.quantity) || args.quantity <= 0) throw new Error('INVALID_QUANTITY')

  const [fromWarehouse, toWarehouse] = await Promise.all([
    tx.warehouse.findFirst({
      where: { id: args.fromWarehouseId, workspaceId: args.workspaceId, active: true },
      select: { id: true, name: true },
    }),
    tx.warehouse.findFirst({
      where: { id: args.toWarehouseId, workspaceId: args.workspaceId, active: true },
      select: { id: true, name: true },
    }),
  ])
  if (!fromWarehouse || !toWarehouse) throw new Error('INVALID_WAREHOUSE')

  const fromBalance = await tx.inventoryByWarehouse.findUnique({
    where: { warehouseId_productId: { warehouseId: args.fromWarehouseId, productId: args.productId } },
    select: { id: true, quantity: true },
  })
  if (!fromBalance || Number(fromBalance.quantity) + 0.000001 < args.quantity) throw new Error('INSUFFICIENT_SOURCE_STOCK')

  const fromUpdated = await tx.inventoryByWarehouse.update({
    where: { id: fromBalance.id },
    data: { quantity: { decrement: args.quantity } },
    select: { quantity: true },
  })

  const toBalance = await tx.inventoryByWarehouse.findUnique({
    where: { warehouseId_productId: { warehouseId: args.toWarehouseId, productId: args.productId } },
    select: { id: true },
  })

  let toNextQty = args.quantity
  if (toBalance) {
    const updated = await tx.inventoryByWarehouse.update({
      where: { id: toBalance.id },
      data: { quantity: { increment: args.quantity } },
      select: { quantity: true },
    })
    toNextQty = Number(updated.quantity ?? 0)
  } else {
    const created = await tx.inventoryByWarehouse.create({
      data: {
        id: makeLocalId('iw'),
        workspaceId: args.workspaceId,
        warehouseId: args.toWarehouseId,
        productId: args.productId,
        quantity: args.quantity,
      },
      select: { quantity: true },
    })
    toNextQty = Number(created.quantity ?? 0)
  }

  const transfer = await tx.inventoryTransfer.create({
    data: {
      id: makeLocalId('it'),
      workspaceId: args.workspaceId,
      productId: args.productId,
      fromWarehouseId: args.fromWarehouseId,
      toWarehouseId: args.toWarehouseId,
      quantity: args.quantity,
      observations: args.observations ?? null,
      createdById: args.userId ?? null,
    },
    select: {
      id: true,
      quantity: true,
      observations: true,
      createdAt: true,
      fromWarehouse: { select: { id: true, name: true } },
      toWarehouse: { select: { id: true, name: true } },
    },
  })

  const lotAllocations = await consumeInventoryLots(tx, {
    workspaceId: args.workspaceId,
    productId: args.productId,
    warehouseId: args.fromWarehouseId,
    preferredLotId: args.sourceLotId ?? null,
    quantity: args.quantity,
    eventType: 'TRANSFER_OUT',
    referenceType: 'InventoryTransfer',
    referenceId: transfer.id,
    notes: args.observations ?? null,
  })

  for (const allocation of lotAllocations) {
    await registerInventoryLotReceipt(tx, {
      workspaceId: args.workspaceId,
      productId: args.productId,
      warehouseId: args.toWarehouseId,
      purchaseOrderId: allocation.purchaseOrderId,
      supplierId: allocation.supplierId,
      lotCode: allocation.lotCode,
      expiresAt: allocation.expiresAt,
      serialCodes: allocation.serialCodes,
      quantity: allocation.quantity,
      notes: args.observations ?? allocation.notes ?? null,
      userId: args.userId,
      eventType: 'TRANSFER_IN',
      referenceType: 'InventoryTransfer',
      referenceId: transfer.id,
    })
  }

  await recordInventoryMovement(tx, {
    workspaceId: args.workspaceId,
    productId: args.productId,
    warehouseId: args.fromWarehouseId,
    transferId: transfer.id,
    actorUserId: args.userId,
    movementType: 'TRANSFER_OUT',
    quantity: -args.quantity,
    referenceType: 'InventoryTransfer',
    referenceId: transfer.id,
    observations: args.observations ?? null,
    balanceAfterWarehouse: Number(fromUpdated.quantity ?? 0),
  })

  await recordInventoryMovement(tx, {
    workspaceId: args.workspaceId,
    productId: args.productId,
    warehouseId: args.toWarehouseId,
    transferId: transfer.id,
    actorUserId: args.userId,
    movementType: 'TRANSFER_IN',
    quantity: args.quantity,
    referenceType: 'InventoryTransfer',
    referenceId: transfer.id,
    observations: args.observations ?? null,
    balanceAfterWarehouse: toNextQty,
  })

  return transfer
}
