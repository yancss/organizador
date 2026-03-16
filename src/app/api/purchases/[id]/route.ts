import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'
import { upsertPayableForPurchase } from '@/lib/finance-defaults'

const PatchSchema = z.object({
  date: z.string().datetime().optional().nullable(),
  quantity: z.coerce.number().positive().optional(),
  cost: z.coerce.number().optional().nullable(),
  supplier: z.string().max(140).optional().nullable(),
  observations: z.string().max(5000).optional().nullable(),
  paid: z.boolean().optional(),
})

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const { id } = await ctx.params

  const body = await req.json().catch(() => null)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  const purchase = await prisma.purchase.findFirst({
    where: { id, workspaceId: wsId },
    select: { id: true, date: true, cost: true },
  })
  if (!purchase) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  const data: any = {}
  if (parsed.data.date !== undefined) data.date = parsed.data.date ? new Date(parsed.data.date) : new Date()
  if (parsed.data.quantity !== undefined) data.quantity = parsed.data.quantity
  if (parsed.data.cost !== undefined) data.cost = parsed.data.cost ?? null
  if (parsed.data.supplier !== undefined) data.supplier = parsed.data.supplier ?? null
  if (parsed.data.observations !== undefined) data.observations = parsed.data.observations ?? null

  await prisma.purchase.update({ where: { id, workspaceId: wsId }, data })

  const next = await prisma.purchase.findFirst({
    where: { id, workspaceId: wsId },
    select: { id: true, date: true, cost: true },
  })

  const paid = parsed.data.paid ?? false
  if (next?.cost != null) {
    await upsertPayableForPurchase({
      workspaceId: wsId,
      purchaseId: id,
      competenceDate: next.date,
      value: Number(next.cost),
      paid,
    })
  }

  return Response.json({ ok: true })
}


