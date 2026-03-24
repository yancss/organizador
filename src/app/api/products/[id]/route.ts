import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'

const UpdateProductSchema = z.object({
  name: z.string().min(1).max(140).optional(),
  brand: z.string().max(140).optional().nullable(),
  kind: z.enum(['RAW', 'FINISHED']).optional(),
  unit: z.string().min(1).max(10).optional(),
  active: z.boolean().optional(),
})

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  const { id } = await ctx.params

  const product = await prisma.product.findFirst({
    where: { id, workspaceId: wsId },
    select: {
      id: true,
      name: true,
      brand: true,
      kind: true,
      unit: true,
      active: true,
      avgCost: true,
      createdAt: true,
      updatedAt: true,
      createdById: true,
      updatedById: true,
      inventory: { select: { id: true, quantity: true, minimum: true } },
    },
  })

  if (!product) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })
  return Response.json({ product })
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const { id } = await ctx.params

  const body = await req.json().catch(() => null)
  const parsed = UpdateProductSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  const prev = await prisma.product.findFirst({
    where: { id, workspaceId: wsId },
    select: { id: true, name: true, brand: true, kind: true, unit: true, active: true },
  })
  if (!prev) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  const data: any = {
    ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
    ...(parsed.data.brand !== undefined ? { brand: parsed.data.brand ?? null } : {}),
    ...(parsed.data.kind !== undefined ? { kind: parsed.data.kind } : {}),
    ...(parsed.data.unit !== undefined ? { unit: parsed.data.unit } : {}),
    ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
    updatedById: auth.user.id,
  }

  const updated = await prisma.product.updateMany({
    where: { id, workspaceId: wsId },
    data,
  })

  if (updated.count === 0) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  const changeRows: Array<{ field: string; from: any; to: any }> = []
  if (parsed.data.name !== undefined && parsed.data.name !== prev.name) changeRows.push({ field: 'name', from: prev.name, to: parsed.data.name })
  if (parsed.data.brand !== undefined && (parsed.data.brand ?? null) !== (prev.brand ?? null)) changeRows.push({ field: 'brand', from: prev.brand ?? null, to: parsed.data.brand ?? null })
  if (parsed.data.kind !== undefined && parsed.data.kind !== prev.kind) changeRows.push({ field: 'kind', from: prev.kind, to: parsed.data.kind })
  if (parsed.data.unit !== undefined && parsed.data.unit !== prev.unit) changeRows.push({ field: 'unit', from: prev.unit, to: parsed.data.unit })
  if (parsed.data.active !== undefined && parsed.data.active !== prev.active) changeRows.push({ field: 'active', from: prev.active, to: parsed.data.active })

  if (changeRows.length) {
    await prisma.auditEvent.create({
      data: {
        workspaceId: wsId,
        category: 'CRUD',
        action: 'UPDATE',
        actorUserId: auth.user.id,
        entityType: 'Product',
        entityId: id,
        summary: `UPDATE Product#${id}`,
        changes: { create: changeRows },
        meta: { via: 'api/products/[id] PATCH' },
      },
    })
  }

  const product = await prisma.product.findFirst({
    where: { id, workspaceId: wsId },
    select: { id: true, name: true, brand: true, kind: true, unit: true, active: true },
  })

  return Response.json({ product })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const { id } = await ctx.params

  // Prefer soft delete (active=false) to avoid FK issues.
  // If you really want hard delete later, we can add a ?hard=1 switch.
  const updated = await prisma.product.updateMany({
    where: { id, workspaceId: wsId },
    data: { active: false },
  })

  if (updated.count === 0) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  return Response.json({ ok: true })
}


