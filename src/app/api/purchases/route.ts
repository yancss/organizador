import { getServerSession } from 'next-auth'
import { z } from 'zod'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { enterWithUser } from '@/lib/request-context'
import { upsertPayableForPurchase } from '@/lib/finance-defaults'

async function requireUser() {
  if (process.env.DISABLE_AUTH === '1') {
    let u = await prisma.user.findFirst({ select: { id: true } })
    if (!u) {
      u = await prisma.user.create({
        data: { email: 'dev@guardian.local', name: 'Dev', active: true, role: 'owner' },
        select: { id: true },
      })
    }
    enterWithUser(u.id)
    return { ok: true as const, userId: u.id }
  }

  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!session || !userId) return { ok: false as const, status: 401, error: 'UNAUTHORIZED' }
  enterWithUser(userId)
  return { ok: true as const, userId }
}

async function ensureWorkspace(userId: string) {
  const existing = await prisma.workspaceMember.findFirst({
    where: { userId, role: 'owner' },
    include: { workspace: true },
  })
  if (existing) return existing.workspace

  const ws = await prisma.workspace.create({
    data: { name: 'Meu espaço', members: { create: { userId, role: 'owner' } } },
  })
  return ws
}

const CreateSchema = z.object({
  productId: z.string().min(1),
  date: z.string().datetime().optional().nullable(),
  quantity: z.coerce.number().positive(),
  cost: z.coerce.number().optional().nullable(),
  supplier: z.string().max(140).optional().nullable(),
  observations: z.string().max(5000).optional().nullable(),

  // payment control
  paid: z.boolean().optional(),
})

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const ws = await ensureWorkspace(auth.userId)

  const purchases = await prisma.purchase.findMany({
    where: { workspaceId: ws.id },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: 200,
    select: {
      id: true,
      date: true,
      quantity: true,
      cost: true,
      supplier: true,
      observations: true,
      product: { select: { id: true, name: true, unit: true } },
      createdAt: true,
      updatedAt: true,
    },
  })

  return Response.json({ purchases })
}

export async function POST(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const ws = await ensureWorkspace(auth.userId)

  const body = await req.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  // product must be RAW
  const product = await prisma.product.findFirst({
    where: { id: parsed.data.productId, workspaceId: ws.id, active: true, kind: 'RAW' },
    select: { id: true },
  })
  if (!product) return Response.json({ error: 'INVALID_PRODUCT' }, { status: 400 })

  const purchase = await prisma.purchase.create({
    data: {
      workspaceId: ws.id,
      productId: parsed.data.productId,
      date: parsed.data.date ? new Date(parsed.data.date) : new Date(),
      quantity: parsed.data.quantity,
      cost: parsed.data.cost ?? null,
      supplier: parsed.data.supplier ?? null,
      observations: parsed.data.observations ?? null,
    },
    select: { id: true, date: true, quantity: true, cost: true, supplier: true, observations: true },
  })

  // Create/Update accounts payable entry (OUT). If paid=true, status becomes PAID.
  const paid = parsed.data.paid ?? false
  if (purchase.cost != null) {
    await upsertPayableForPurchase({
      workspaceId: ws.id,
      purchaseId: purchase.id,
      competenceDate: purchase.date,
      value: Number(purchase.cost),
      paid,
    })
  }

  return Response.json({ purchase }, { status: 201 })
}
