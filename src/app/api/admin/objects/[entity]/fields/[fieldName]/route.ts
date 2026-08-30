import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/authz'
import { isCustomFieldEntity } from '@/lib/custom-fields/registry'
import { getNativeFields, isEditableEligible } from '@/lib/custom-fields/native-fields'

const PatchSchema = z.object({
  label: z.string().max(120).optional().nullable(),
  visible: z.coerce.boolean().optional(),
  editable: z.coerce.boolean().optional(),
  order: z.coerce.number().int().min(0).max(9999).optional(),
})

/** Config de exibição/edição de UM campo nativo. */
export async function PATCH(req: Request, ctx: { params: Promise<{ entity: string; fieldName: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  const { entity, fieldName } = await ctx.params
  if (!isCustomFieldEntity(entity)) return Response.json({ error: 'INVALID_ENTITY' }, { status: 404 })

  const native = getNativeFields(entity)
  const field = native.scalars.find((f) => f.name === fieldName)
  if (!field) return Response.json({ error: 'FIELD_NOT_FOUND' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })

  if (parsed.data.editable === true && !isEditableEligible(entity, fieldName)) {
    return Response.json({ error: 'FIELD_NOT_EDITABLE' }, { status: 409 })
  }

  const data = {
    ...(parsed.data.label !== undefined ? { label: parsed.data.label?.trim() || null } : {}),
    ...(parsed.data.visible !== undefined ? { visible: parsed.data.visible } : {}),
    ...(parsed.data.editable !== undefined ? { editable: parsed.data.editable } : {}),
    ...(parsed.data.order !== undefined ? { order: parsed.data.order } : {}),
    updatedById: auth.user.id,
  }

  const saved = await prisma.entityFieldConfig.upsert({
    where: { workspaceId_entity_fieldName: { workspaceId: wsId, entity, fieldName } },
    update: data,
    create: { workspaceId: wsId, entity, fieldName, ...data },
    select: { fieldName: true, label: true, visible: true, editable: true, order: true },
  })

  await prisma.auditEvent.create({
    data: {
      workspaceId: wsId,
      category: 'PERMISSIONS',
      action: 'UPDATE',
      actorUserId: auth.user.id,
      entityType: 'EntityFieldConfig',
      entityId: `${entity}.${fieldName}`,
      summary: `UPDATE native field config ${entity}.${fieldName}`,
      meta: { entity },
    },
    select: { id: true },
  })

  return Response.json({ config: saved })
}
