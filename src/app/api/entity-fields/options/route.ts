import { requireWorkspace } from '@/lib/authz'
import { isCustomFieldEntity } from '@/lib/custom-fields/registry'
import { listEntityRecords } from '@/lib/custom-fields/entity-records'

/**
 * Opções de um campo RELATION: registros do objeto alvo (id + rótulo), no workspace.
 * GET /api/entity-fields/options?entity=CLIENT&q=abc
 */
export async function GET(req: Request) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const url = new URL(req.url)
  const entity = (url.searchParams.get('entity') ?? '').trim()
  const q = (url.searchParams.get('q') ?? '').trim()
  if (!isCustomFieldEntity(entity)) return Response.json({ error: 'INVALID_ENTITY' }, { status: 400 })

  const options = await listEntityRecords(entity, auth.user.workspaceId, { q, take: 100 })
  return Response.json({ options })
}
