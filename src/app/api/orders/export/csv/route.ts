import { requireWorkspace } from '@/lib/authz'
import { buildOrdersCsvExport, fetchOrdersForExport } from '@/lib/orders-export'

export async function GET(req: Request) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  const url = new URL(req.url)
  const data = await fetchOrdersForExport({ workspaceId: wsId, userId: auth.user.id, params: url.searchParams })
  const result = buildOrdersCsvExport(data.orders, data.truncated, data.maxRows)
  const body = typeof result.content === 'string' ? result.content : new Uint8Array(result.content)

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': result.contentType,
      'Content-Disposition': `attachment; filename="${result.fileName}"`,
      'Cache-Control': 'no-store',
      'X-Export-Row-Limit': String(data.maxRows),
      'X-Export-Truncated': result.truncated ? '1' : '0',
    },
  })
}
