import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'

const QuerySchema = z.object({
  model: z.enum(['Product', 'Client', 'FinancialAccount', 'FinancialCategory', 'CostCenter']),
  ids: z.string().min(1),
})

export async function GET(req: Request) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const url = new URL(req.url)
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()))
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_QUERY', details: parsed.error.flatten() }, { status: 400 })
  }

  const ids = parsed.data.ids
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 200)

  const model = parsed.data.model

  const selectName = (row: any) => ({ id: row.id, name: row.name ?? null })

  if (model === 'Product') {
    const rows = await prisma.product.findMany({ where: { workspaceId: wsId, id: { in: ids } }, select: { id: true, name: true } })
    return Response.json({ items: rows.map(selectName) })
  }

  if (model === 'Client') {
    const rows = await prisma.client.findMany({ where: { workspaceId: wsId, id: { in: ids } }, select: { id: true, name: true } })
    return Response.json({ items: rows.map(selectName) })
  }

  if (model === 'FinancialAccount') {
    const rows = await prisma.financialAccount.findMany({ where: { workspaceId: wsId, id: { in: ids } }, select: { id: true, name: true } })
    return Response.json({ items: rows.map(selectName) })
  }

  if (model === 'FinancialCategory') {
    const rows = await prisma.financialCategory.findMany({ where: { workspaceId: wsId, id: { in: ids } }, select: { id: true, name: true } })
    return Response.json({ items: rows.map(selectName) })
  }

  if (model === 'CostCenter') {
    const rows = await prisma.costCenter.findMany({ where: { workspaceId: wsId, id: { in: ids } }, select: { id: true, name: true } })
    return Response.json({ items: rows.map(selectName) })
  }

  return Response.json({ items: [] })
}
