import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/authz'
import { CUSTOM_FIELD_ENTITIES } from '@/lib/custom-fields/registry'
import { getNativeFields } from '@/lib/custom-fields/native-fields'
import { getEntityDisplayMap } from '@/lib/custom-fields/entity-config'

/** Lista de todos os objetos do sistema com contagem de campos nativos e personalizados. */
export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const grouped = await prisma.customFieldDefinition.groupBy({
    by: ['entity'],
    where: { workspaceId: wsId },
    _count: { _all: true },
  })
  const customByEntity = new Map(grouped.map((g) => [g.entity, g._count._all]))
  const displayByEntity = await getEntityDisplayMap(wsId)

  const objects = CUSTOM_FIELD_ENTITIES.map((e) => {
    const native = getNativeFields(e.key)
    const display = displayByEntity.get(e.key)
    return {
      key: e.key,
      group: e.group,
      labels: e.labels,
      configuredLabel: display?.label ?? null,
      description: display?.description ?? null,
      nativeCount: native.scalars.length,
      relationCount: native.relations.length,
      customCount: customByEntity.get(e.key) ?? 0,
    }
  })

  return Response.json({ objects })
}
