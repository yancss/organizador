import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/authz'
import { getCustomFieldEntity, isCustomFieldEntity } from '@/lib/custom-fields/registry'
import { getNativeFieldViews } from '@/lib/custom-fields/entity-field-config'

/** Ficha completa de um objeto: campos nativos (somente leitura) + campos personalizados. */
export async function GET(_req: Request, ctx: { params: Promise<{ entity: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { entity } = await ctx.params
  if (!isCustomFieldEntity(entity)) return Response.json({ error: 'INVALID_ENTITY' }, { status: 404 })

  const def = getCustomFieldEntity(entity)!
  const native = await getNativeFieldViews(auth.user.workspaceId, entity)

  const custom = await prisma.customFieldDefinition.findMany({
    where: { workspaceId: auth.user.workspaceId, entity },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      key: true,
      label: true,
      type: true,
      required: true,
      active: true,
      helpText: true,
      options: true,
      order: true,
      _count: { select: { values: true } },
    },
  })

  return Response.json({
    entity: def.key,
    group: def.group,
    labels: def.labels,
    native,
    custom,
  })
}
