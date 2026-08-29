import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'

type Tx = Parameters<typeof prisma.$transaction>[0] extends (tx: infer T) => any ? T : never

function makeLocalId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`
}

function quantitySql(value: number) {
  return Prisma.sql`${value}::decimal`
}

function roundQty(value: number) {
  return Math.round(value * 1000) / 1000
}

export type InventoryLotAllocation = {
  sourceLotId: string | null
  lotCode: string
  expiresAt: Date | null
  quantity: number
  serialCodes: string[]
  supplierId: string | null
  purchaseOrderId: string | null
  notes: string | null
}

function legacyAllocation(quantity: number): InventoryLotAllocation {
  return {
    sourceLotId: null,
    lotCode: 'LEGACY-STOCK',
    expiresAt: null,
    quantity: roundQty(quantity),
    serialCodes: [],
    supplierId: null,
    purchaseOrderId: null,
    notes: 'Legacy stock without tracked lot origin.',
  }
}

async function recordInventoryLotEvent(
  tx: Tx,
  args: {
    workspaceId: string
    productId: string
    warehouseId?: string | null
    lotId?: string | null
    eventType: string
    quantity: number
    serialCodes?: string[]
    referenceType?: string | null
    referenceId?: string | null
    notes?: string | null
  },
) {
  if (!Number.isFinite(args.quantity) || Math.abs(args.quantity) <= 0.000001) return
  const serialCodes = [...new Set((args.serialCodes ?? []).map((item) => item.trim()).filter(Boolean))]

  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "InventoryLotEvent" (
      "id", "workspaceId", "productId", "warehouseId", "lotId",
      "eventType", "quantity", "serialCodes", "referenceType", "referenceId", "notes", "createdAt"
    ) VALUES (
      ${makeLocalId('lot_evt')}, ${args.workspaceId}, ${args.productId}, ${args.warehouseId ?? null}, ${args.lotId ?? null},
      ${args.eventType}, ${quantitySql(roundQty(args.quantity))}, ${serialCodes}::text[], ${args.referenceType ?? null},
      ${args.referenceId ?? null}, ${args.notes?.trim() ? args.notes.trim() : null}, CURRENT_TIMESTAMP
    )
  `)
}

export async function registerInventoryLotReceipt(
  tx: Tx,
  args: {
    workspaceId: string
    productId: string
    warehouseId?: string | null
    purchaseOrderId?: string | null
    supplierId?: string | null
    lotCode: string
    expiresAt?: Date | null
    serialCodes?: string[]
    quantity: number
    notes?: string | null
    userId?: string | null
    eventType?: string | null
    referenceType?: string | null
    referenceId?: string | null
  },
) {
  const lotCode = args.lotCode.trim()
  if (!lotCode) return null
  if (!Number.isFinite(args.quantity) || args.quantity <= 0) return null
  const serialCodes = [...new Set((args.serialCodes ?? []).map((item) => item.trim()).filter(Boolean))]

  const existing = args.warehouseId
    ? await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "id"
        FROM "InventoryLot"
        WHERE "workspaceId" = ${args.workspaceId}
          AND "productId" = ${args.productId}
          AND "warehouseId" = ${args.warehouseId}
          AND "lotCode" = ${lotCode}
          AND ${args.expiresAt ? Prisma.sql`"expiresAt" = ${args.expiresAt}` : Prisma.sql`"expiresAt" IS NULL`}
        ORDER BY "createdAt" DESC
        LIMIT 1
      `)
    : await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "id"
        FROM "InventoryLot"
        WHERE "workspaceId" = ${args.workspaceId}
          AND "productId" = ${args.productId}
          AND "warehouseId" IS NULL
          AND "lotCode" = ${lotCode}
          AND ${args.expiresAt ? Prisma.sql`"expiresAt" = ${args.expiresAt}` : Prisma.sql`"expiresAt" IS NULL`}
        ORDER BY "createdAt" DESC
        LIMIT 1
      `)

  if (existing[0]?.id) {
    await tx.$executeRaw(Prisma.sql`
      UPDATE "InventoryLot"
      SET
        "quantity" = "quantity" + ${quantitySql(args.quantity)},
        "serialCodes" = ARRAY(SELECT DISTINCT unnest(array_cat("serialCodes", ${serialCodes}::text[]))),
        "notes" = ${args.notes?.trim() ? args.notes.trim() : null},
        "updatedById" = ${args.userId ?? null},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${existing[0].id}
    `)
    await recordInventoryLotEvent(tx, {
      workspaceId: args.workspaceId,
      productId: args.productId,
      warehouseId: args.warehouseId ?? null,
      lotId: existing[0].id,
      eventType: args.eventType ?? 'LOT_RECEIPT',
      quantity: args.quantity,
      serialCodes,
      referenceType: args.referenceType ?? null,
      referenceId: args.referenceId ?? null,
      notes: args.notes ?? null,
    })
    return { id: existing[0].id }
  }

  const id = makeLocalId('lot')
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "InventoryLot" (
      "id", "workspaceId", "productId", "warehouseId", "purchaseOrderId", "supplierId",
      "createdById", "updatedById", "lotCode", "expiresAt", "serialCodes", "quantity", "receivedAt", "notes", "createdAt", "updatedAt"
    ) VALUES (
      ${id}, ${args.workspaceId}, ${args.productId}, ${args.warehouseId ?? null}, ${args.purchaseOrderId ?? null}, ${args.supplierId ?? null},
      ${args.userId ?? null}, ${args.userId ?? null}, ${lotCode}, ${args.expiresAt ?? null}, ${serialCodes}::text[], ${quantitySql(args.quantity)}, CURRENT_TIMESTAMP,
      ${args.notes?.trim() ? args.notes.trim() : null}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `)
  await recordInventoryLotEvent(tx, {
    workspaceId: args.workspaceId,
    productId: args.productId,
    warehouseId: args.warehouseId ?? null,
    lotId: id,
    eventType: args.eventType ?? 'LOT_RECEIPT',
    quantity: args.quantity,
    serialCodes,
    referenceType: args.referenceType ?? null,
    referenceId: args.referenceId ?? null,
    notes: args.notes ?? null,
  })
  return { id }
}

export async function listInventoryLots(
  db: typeof prisma | Tx,
  args: {
    workspaceId: string
    productId: string
  },
) {
  return db.$queryRaw<
    Array<{
      id: string
      lotCode: string
      expiresAt: Date | null
      serialCodes: string[]
      quantity: unknown
      receivedAt: Date
      notes: string | null
      warehouseId: string | null
      warehouseName: string | null
      warehouseCode: string | null
      purchaseOrderId: string | null
      supplierId: string | null
      supplierName: string | null
    }>
  >(Prisma.sql`
    SELECT
      lot."id",
      lot."lotCode",
      lot."expiresAt",
      lot."serialCodes",
      lot."quantity",
      lot."receivedAt",
      lot."notes",
      lot."warehouseId",
      wh."name" AS "warehouseName",
      wh."code" AS "warehouseCode",
      lot."purchaseOrderId",
      lot."supplierId",
      cli."name" AS "supplierName"
    FROM "InventoryLot" lot
    LEFT JOIN "Warehouse" wh ON wh."id" = lot."warehouseId"
    LEFT JOIN "Client" cli ON cli."id" = lot."supplierId"
    WHERE lot."workspaceId" = ${args.workspaceId}
      AND lot."productId" = ${args.productId}
      AND lot."quantity" > 0
    ORDER BY
      CASE WHEN lot."expiresAt" IS NULL THEN 1 ELSE 0 END,
      lot."expiresAt" ASC,
      lot."receivedAt" DESC
  `)
}

export async function consumeInventoryLots(
  tx: Tx,
  args: {
    workspaceId: string
    productId: string
    warehouseId?: string | null
    preferredLotId?: string | null
    preferredSerialCodes?: string[]
    quantity: number
    eventType?: string | null
    referenceType?: string | null
    referenceId?: string | null
    notes?: string | null
  },
) {
  const requestedQty = roundQty(args.quantity)
  if (!Number.isFinite(requestedQty) || requestedQty <= 0) return [] as InventoryLotAllocation[]
  const preferredSerialCodes = [...new Set((args.preferredSerialCodes ?? []).map((item) => item.trim()).filter(Boolean))]

  const rows = await tx.$queryRaw<
    Array<{
      id: string
      lotCode: string
      expiresAt: Date | null
      serialCodes: string[]
      quantity: unknown
      supplierId: string | null
      purchaseOrderId: string | null
      notes: string | null
    }>
  >(Prisma.sql`
    SELECT
      lot."id",
      lot."lotCode",
      lot."expiresAt",
      lot."serialCodes",
      lot."quantity",
      lot."supplierId",
      lot."purchaseOrderId",
      lot."notes"
    FROM "InventoryLot" lot
    WHERE lot."workspaceId" = ${args.workspaceId}
      AND lot."productId" = ${args.productId}
      AND lot."quantity" > 0
      AND ${args.preferredLotId ? Prisma.sql`lot."id" = ${args.preferredLotId}` : Prisma.sql`TRUE`}
      AND ${
        args.warehouseId
          ? Prisma.sql`lot."warehouseId" = ${args.warehouseId}`
          : Prisma.sql`lot."warehouseId" IS NULL OR lot."warehouseId" IS NOT NULL`
      }
    ORDER BY
      CASE WHEN lot."expiresAt" IS NULL THEN 1 ELSE 0 END,
      lot."expiresAt" ASC,
      lot."receivedAt" ASC,
      lot."createdAt" ASC
  `)

  let remaining = requestedQty
  const allocations: InventoryLotAllocation[] = []

  for (const row of rows) {
    if (remaining <= 0.000001) break
    const availableQty = Number(row.quantity ?? 0)
    if (!Number.isFinite(availableQty) || availableQty <= 0.000001) continue
    const consumeQty = roundQty(Math.min(availableQty, remaining))
    if (consumeQty <= 0) continue
    const availableSerialCodes = (row.serialCodes ?? []).filter(Boolean)
    let consumedSerialCodes: string[] = []
    let nextSerialCodes = availableSerialCodes

    if (availableSerialCodes.length) {
      if (preferredSerialCodes.length) {
        const missing = preferredSerialCodes.filter((code) => !availableSerialCodes.includes(code))
        if (missing.length) throw new Error('INVALID_SERIAL_SELECTION')
        if (Math.abs(consumeQty - preferredSerialCodes.length) > 0.000001) {
          throw new Error('SERIAL_SELECTION_QUANTITY_MISMATCH')
        }
        consumedSerialCodes = preferredSerialCodes
        nextSerialCodes = availableSerialCodes.filter((code) => !preferredSerialCodes.includes(code))
      } else {
        if (Math.abs(consumeQty - availableSerialCodes.length) > 0.000001) {
          throw new Error('SERIALIZED_LOT_PARTIAL_CONSUMPTION_UNSUPPORTED')
        }
        consumedSerialCodes = availableSerialCodes
        nextSerialCodes = []
      }
    }

    await tx.$executeRaw(Prisma.sql`
      UPDATE "InventoryLot"
      SET
        "quantity" = "quantity" - ${quantitySql(consumeQty)},
        "serialCodes" = ${availableSerialCodes.length ? Prisma.sql`${nextSerialCodes}::text[]` : Prisma.sql`"serialCodes"`},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${row.id}
    `)

    await recordInventoryLotEvent(tx, {
      workspaceId: args.workspaceId,
      productId: args.productId,
      warehouseId: args.warehouseId ?? null,
      lotId: row.id,
      eventType: args.eventType ?? 'LOT_CONSUMPTION',
      quantity: -consumeQty,
      serialCodes: consumedSerialCodes,
      referenceType: args.referenceType ?? null,
      referenceId: args.referenceId ?? null,
      notes: args.notes ?? row.notes ?? null,
    })

    allocations.push({
      sourceLotId: row.id,
      lotCode: row.lotCode,
      expiresAt: row.expiresAt,
      quantity: consumeQty,
      serialCodes: consumedSerialCodes,
      supplierId: row.supplierId,
      purchaseOrderId: row.purchaseOrderId,
      notes: row.notes,
    })
    remaining = roundQty(remaining - consumeQty)
  }

  if (remaining > 0.000001 && args.preferredLotId) {
    throw new Error('INSUFFICIENT_SOURCE_STOCK')
  }

  if (remaining > 0.000001) {
    allocations.push(legacyAllocation(remaining))
  }

  return allocations
}
