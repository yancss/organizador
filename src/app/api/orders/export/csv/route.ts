import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'
import { buildSalesOrdersWhere } from '@/lib/orders-query'

function csvEscape(v: any) {
  const s = v == null ? '' : String(v)
  if (/[",\n\r;]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

export async function GET(req: Request) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  const url = new URL(req.url)
  const where = buildSalesOrdersWhere({ wsId, userId: auth.user.id, params: url.searchParams })

  const orders = await prisma.salesOrder.findMany({
    where,
    orderBy: [{ deliveryAt: 'asc' }, { createdAt: 'desc' }],
    select: {
      code: true,
      name: true,
      status: true,
      orderedAt: true,
      deliveryAt: true,
      value: true,
      discountMode: true,
      discountType: true,
      discountValue: true,
      discountPercent: true,
      createdAt: true,
      client: { select: { name: true } },
      owner: { select: { name: true, email: true } },
    },
  })

  const header = [
    'code',
    'name',
    'client',
    'status',
    'orderedAt',
    'deliveryAt',
    'value_total',
    'discountMode',
    'discountType',
    'discountValue',
    'discountPercent',
    'responsavel',
    'createdAt',
  ]
  const lines = [header.join(';')]

  for (const o of orders) {
    lines.push(
      [
        o.code,
        o.name,
        o.client?.name,
        o.status,
        o.orderedAt ? o.orderedAt.toISOString() : '',
        o.deliveryAt ? o.deliveryAt.toISOString() : '',
        o.value != null ? String(o.value) : '',
        o.discountMode ?? '',
        o.discountType ?? '',
        o.discountValue != null ? String(o.discountValue) : '',
        o.discountPercent != null ? String(o.discountPercent) : '',
        o.owner?.name ?? o.owner?.email ?? '',
        o.createdAt.toISOString(),
      ]
        .map(csvEscape)
        .join(';'),
    )
  }

  const csv = lines.join('\n')
  const filename = `sales-orders-${new Date().toISOString().slice(0, 10)}.csv`

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
