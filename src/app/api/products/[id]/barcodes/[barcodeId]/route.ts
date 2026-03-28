import { NextRequest } from 'next/server'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string; barcodeId: string }> }) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  const { id: productId, barcodeId } = await ctx.params

  const found = await prisma.productBarcode.findFirst({ where: { id: barcodeId, workspaceId: wsId }, select: { id: true, productId: true, code: true } })
  if (!found) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })
  if (found.productId !== productId) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  await prisma.productBarcode.deleteMany({ where: { id: barcodeId, workspaceId: wsId } })

  await prisma.auditEvent.create({
    data: {
      workspaceId: wsId,
      category: 'CRUD',
      action: 'DELETE',
      actorUserId: auth.user.id,
      entityType: 'ProductBarcode',
      entityId: barcodeId,
      summary: `DELETE ProductBarcode#${barcodeId}`,
      changes: { create: [{ field: 'code', from: found.code }, { field: 'productId', from: found.productId }] },
      meta: { via: 'api/products/[id]/barcodes/[barcodeId] DELETE' },
    },
  })

  return Response.json({ ok: true })
}
