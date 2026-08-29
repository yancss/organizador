import { prisma } from '@/lib/prisma'

type Tx = Parameters<typeof prisma.$transaction>[0] extends (tx: infer T) => any ? T : never

export type InventoryMovementInput = {
  workspaceId: string
  productId: string
  warehouseId?: string | null
  transferId?: string | null
  actorUserId?: string | null
  movementType:
    | 'MANUAL_ADJUSTMENT'
    | 'PURCHASE_RECEIPT'
    | 'PURCHASE_RECEIPT_REVERSAL'
    | 'PRODUCTION_CONSUMPTION'
    | 'PRODUCTION_OUTPUT'
    | 'DELIVERY_SHIPMENT'
    | 'DELIVERY_RETURN'
    | 'TRANSFER_OUT'
    | 'TRANSFER_IN'
  quantity: number
  unitCost?: number | null
  referenceType?: string | null
  referenceId?: string | null
  observations?: string | null
  balanceAfterGlobal?: number | null
  balanceAfterWarehouse?: number | null
}

export async function recordInventoryMovement(tx: Tx, args: InventoryMovementInput) {
  if (!Number.isFinite(args.quantity) || Math.abs(args.quantity) <= 0.000001) return null

  return tx.inventoryMovement.create({
    data: {
      workspaceId: args.workspaceId,
      productId: args.productId,
      warehouseId: args.warehouseId ?? null,
      transferId: args.transferId ?? null,
      actorUserId: args.actorUserId ?? null,
      movementType: args.movementType,
      quantity: args.quantity,
      unitCost: args.unitCost ?? null,
      referenceType: args.referenceType ?? null,
      referenceId: args.referenceId ?? null,
      observations: args.observations ?? null,
      balanceAfterGlobal: args.balanceAfterGlobal ?? null,
      balanceAfterWarehouse: args.balanceAfterWarehouse ?? null,
    },
    select: { id: true },
  })
}
