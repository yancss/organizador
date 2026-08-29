import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'

function parsePositiveInt(value: string | null, fallback: number, max: number) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(max, Math.floor(n))
}

export async function GET(req: Request) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  const url = new URL(req.url)
  const productId = (url.searchParams.get('productId') ?? '').trim()
  const lotId = (url.searchParams.get('lotId') ?? '').trim()
  const lotCode = (url.searchParams.get('lotCode') ?? '').trim()
  const referenceType = (url.searchParams.get('referenceType') ?? '').trim()
  const referenceId = (url.searchParams.get('referenceId') ?? '').trim()
  const take = parsePositiveInt(url.searchParams.get('take'), 30, 200)

  const events = await prisma.$queryRaw<
    Array<{
      id: string
      productId: string
      warehouseId: string | null
      lotId: string | null
      eventType: string
      quantity: unknown
      serialCodes: string[]
      referenceType: string | null
      referenceId: string | null
      notes: string | null
      createdAt: Date
      productName: string | null
      productUnit: string | null
      warehouseName: string | null
      lotCode: string | null
      lotExpiresAt: Date | null
    }>
  >(Prisma.sql`
    SELECT
      evt."id",
      evt."productId",
      evt."warehouseId",
      evt."lotId",
      evt."eventType",
      evt."quantity",
      evt."serialCodes",
      evt."referenceType",
      evt."referenceId",
      evt."notes",
      evt."createdAt",
      prod."name" AS "productName",
      prod."unit" AS "productUnit",
      wh."name" AS "warehouseName",
      lot."lotCode",
      lot."expiresAt" AS "lotExpiresAt"
    FROM "InventoryLotEvent" evt
    LEFT JOIN "Product" prod ON prod."id" = evt."productId"
    LEFT JOIN "Warehouse" wh ON wh."id" = evt."warehouseId"
    LEFT JOIN "InventoryLot" lot ON lot."id" = evt."lotId"
    WHERE evt."workspaceId" = ${wsId}
      AND ${productId ? Prisma.sql`evt."productId" = ${productId}` : Prisma.sql`TRUE`}
      AND ${lotId ? Prisma.sql`evt."lotId" = ${lotId}` : Prisma.sql`TRUE`}
      AND ${lotCode ? Prisma.sql`lot."lotCode" ILIKE ${`%${lotCode}%`}` : Prisma.sql`TRUE`}
      AND ${referenceType ? Prisma.sql`evt."referenceType" = ${referenceType}` : Prisma.sql`TRUE`}
      AND ${referenceId ? Prisma.sql`evt."referenceId" = ${referenceId}` : Prisma.sql`TRUE`}
    ORDER BY evt."createdAt" DESC
    LIMIT ${take}
  `)

  const movements = referenceType && referenceId
    ? await prisma.inventoryMovement.findMany({
        where: {
          workspaceId: wsId,
          referenceType,
          referenceId,
          ...(productId ? { productId } : {}),
        },
        orderBy: [{ createdAt: 'desc' }],
        take,
        select: {
          id: true,
          movementType: true,
          quantity: true,
          observations: true,
          balanceAfterGlobal: true,
          balanceAfterWarehouse: true,
          createdAt: true,
          product: { select: { id: true, name: true, unit: true } },
          warehouse: { select: { id: true, name: true, code: true } },
        },
      })
    : []

  return Response.json({ events, movements })
}
