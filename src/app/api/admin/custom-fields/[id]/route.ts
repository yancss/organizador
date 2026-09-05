import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/authz'
import { isCustomFieldEntity } from '@/lib/custom-fields/registry'

const DEF_SELECT = {
  id: true,
  entity: true,
  key: true,
  label: true,
  type: true,
  required: true,
  active: true,
  helpText: true,
  options: true,
  order: true,
  relationEntity: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { values: true } },
} as const

const PatchSchema = z.object({
  label: z.string().min(1).max(120).optional(),
  required: z.coerce.boolean().optional(),
  active: z.coerce.boolean().optional(),
  helpText: z.string().max(400).optional().nullable(),
  options: z.array(z.string().min(1).max(120)).max(50).optional(),
  order: z.coerce.number().int().min(0).max(9999).optional(),
  type: z.enum(['STRING', 'NUMBER', 'CURRENCY', 'DATE', 'BOOLEAN', 'SELECT', 'RELATION']).optional(),
  relationEntity: z.string().max(64).optional().nullable(),
})

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  const { id } = await ctx.params

  const body = await req.json().catch(() => null)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  const def = await prisma.customFieldDefinition.findFirst({
    where: { id, workspaceId: wsId },
    select: { id: true, entity: true, type: true, relationEntity: true, _count: { select: { values: true } } },
  })
  if (!def) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  const hasValues = def._count.values > 0
  if (parsed.data.type && parsed.data.type !== def.type && hasValues) {
    return Response.json({ error: 'TYPE_LOCKED_WITH_VALUES' }, { status: 409 })
  }

  const options = parsed.data.options
    ? [...new Set(parsed.data.options.map((o) => o.trim()).filter(Boolean))]
    : undefined
  const nextType = parsed.data.type ?? def.type
  if (nextType === 'SELECT' && options && options.length < 2) {
    return Response.json({ error: 'SELECT_NEEDS_OPTIONS' }, { status: 400 })
  }

  const relationEntity =
    parsed.data.relationEntity === undefined ? undefined : parsed.data.relationEntity?.trim() || null
  const nextRelationEntity = relationEntity === undefined ? def.relationEntity : relationEntity
  if (nextType === 'RELATION') {
    if (!nextRelationEntity || !isCustomFieldEntity(nextRelationEntity)) {
      return Response.json({ error: 'RELATION_NEEDS_TARGET' }, { status: 400 })
    }
    if (nextRelationEntity === def.entity) {
      return Response.json({ error: 'RELATION_SELF' }, { status: 400 })
    }
    if (hasValues && nextRelationEntity !== def.relationEntity) {
      return Response.json({ error: 'RELATION_LOCKED_WITH_VALUES' }, { status: 409 })
    }
  }

  const updated = await prisma.customFieldDefinition.update({
    where: { id },
    data: {
      ...(parsed.data.label !== undefined ? { label: parsed.data.label.trim() } : {}),
      ...(parsed.data.required !== undefined ? { required: parsed.data.required } : {}),
      ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
      ...(parsed.data.helpText !== undefined ? { helpText: parsed.data.helpText?.trim() || null } : {}),
      ...(options !== undefined ? { options } : {}),
      ...(parsed.data.order !== undefined ? { order: parsed.data.order } : {}),
      ...(parsed.data.type !== undefined && !hasValues ? { type: parsed.data.type } : {}),
      ...(nextType === 'RELATION'
        ? { relationEntity: nextRelationEntity }
        : parsed.data.type !== undefined && !hasValues
          ? { relationEntity: null }
          : {}),
      updatedById: auth.user.id,
    },
    select: DEF_SELECT,
  })

  await prisma.auditEvent.create({
    data: {
      workspaceId: wsId,
      category: 'PERMISSIONS',
      action: 'UPDATE',
      actorUserId: auth.user.id,
      entityType: 'CustomFieldDefinition',
      entityId: id,
      summary: `UPDATE custom field ${updated.entity}.${updated.key}`,
      meta: { entity: updated.entity },
    },
    select: { id: true },
  })

  return Response.json({ definition: updated })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  const { id } = await ctx.params

  const def = await prisma.customFieldDefinition.findFirst({
    where: { id, workspaceId: wsId },
    select: { id: true, entity: true, key: true, _count: { select: { values: true } } },
  })
  if (!def) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })
  if (def._count.values > 0) {
    return Response.json({ error: 'HAS_VALUES', hint: 'DEACTIVATE_INSTEAD', count: def._count.values }, { status: 409 })
  }

  await prisma.customFieldDefinition.delete({ where: { id } })
  await prisma.auditEvent.create({
    data: {
      workspaceId: wsId,
      category: 'PERMISSIONS',
      action: 'DELETE',
      actorUserId: auth.user.id,
      entityType: 'CustomFieldDefinition',
      entityId: id,
      summary: `DELETE custom field ${def.entity}.${def.key}`,
      meta: { entity: def.entity },
    },
    select: { id: true },
  })

  return Response.json({ ok: true })
}
