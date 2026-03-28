import { NextRequest } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'

const CreateSchema = z.object({
  code: z.string().min(3).max(64),
  source: z.enum(['INTERNAL', 'OPEN_FOOD_FACTS']).optional(),
  externalRef: z.string().max(140).optional().nullable(),
})

function normalizeCode(code: string) {
  return code.trim().replace(/\s+/g, '')
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  const { id: productId } = await ctx.params

  const product = await prisma.product.findFirst({ where: { id: productId, workspaceId: wsId }, select: { id: true } })
  if (!product) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  const barcodes = await prisma.productBarcode.findMany({
    where: { workspaceId: wsId, productId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, code: true, source: true, externalRef: true, createdAt: true },
  })

  return Response.json({ barcodes })
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  const { id: productId } = await ctx.params

  const body = await req.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  const product = await prisma.product.findFirst({ where: { id: productId, workspaceId: wsId }, select: { id: true } })
  if (!product) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  const code = normalizeCode(parsed.data.code)

  try {
    const barcode = await prisma.productBarcode.create({
      data: {
        workspaceId: wsId,
        productId,
        code,
        source: (parsed.data.source as any) ?? 'INTERNAL',
        externalRef: parsed.data.externalRef ?? null,
        createdById: auth.user.id,
      },
      select: { id: true, code: true, source: true, externalRef: true, createdAt: true },
    })

    await prisma.auditEvent.create({
      data: {
        workspaceId: wsId,
        category: 'CRUD',
        action: 'CREATE',
        actorUserId: auth.user.id,
        entityType: 'ProductBarcode',
        entityId: barcode.id,
        summary: `CREATE ProductBarcode#${barcode.id}`,
        changes: { create: [{ field: 'code', to: code }, { field: 'productId', to: productId }] },
        meta: { via: 'api/products/[id]/barcodes POST' },
      },
    })

    return Response.json({ barcode }, { status: 201 })
  } catch (e: any) {
    // Unique constraint (workspaceId + code)
    if (String(e?.code ?? '') === 'P2002') {
      return Response.json({ error: 'BARCODE_ALREADY_EXISTS' }, { status: 409 })
    }
    throw e
  }
}
