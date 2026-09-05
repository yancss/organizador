import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/authz'
import { CUSTOM_FIELD_ENTITIES, isCustomFieldEntity } from '@/lib/custom-fields/registry'
import { CUSTOM_FIELD_TYPES, slugifyFieldKey } from '@/lib/custom-fields/field-types'

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

export async function GET(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  const entity = (new URL(req.url).searchParams.get('entity') ?? '').trim()

  const defs = await prisma.customFieldDefinition.findMany({
    where: { workspaceId: wsId, ...(entity && isCustomFieldEntity(entity) ? { entity } : {}) },
    orderBy: [{ entity: 'asc' }, { order: 'asc' }, { createdAt: 'asc' }],
    select: DEF_SELECT,
  })

  return Response.json({
    entities: CUSTOM_FIELD_ENTITIES.map((e) => ({ key: e.key, group: e.group, labels: e.labels })),
    types: CUSTOM_FIELD_TYPES,
    definitions: defs,
  })
}

const CreateSchema = z.object({
  entity: z.string().min(1),
  label: z.string().min(1).max(120),
  type: z.enum(['STRING', 'NUMBER', 'CURRENCY', 'DATE', 'BOOLEAN', 'SELECT', 'RELATION']),
  required: z.coerce.boolean().optional(),
  helpText: z.string().max(400).optional().nullable(),
  options: z.array(z.string().min(1).max(120)).max(50).optional(),
  order: z.coerce.number().int().min(0).max(9999).optional(),
  relationEntity: z.string().max(64).optional().nullable(),
})

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  const body = await req.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }
  if (!isCustomFieldEntity(parsed.data.entity)) {
    return Response.json({ error: 'INVALID_ENTITY' }, { status: 400 })
  }
  const options = [...new Set((parsed.data.options ?? []).map((o) => o.trim()).filter(Boolean))]
  if (parsed.data.type === 'SELECT' && options.length < 2) {
    return Response.json({ error: 'SELECT_NEEDS_OPTIONS' }, { status: 400 })
  }

  const relationEntity = parsed.data.relationEntity?.trim() || null
  if (parsed.data.type === 'RELATION') {
    if (!relationEntity || !isCustomFieldEntity(relationEntity)) {
      return Response.json({ error: 'RELATION_NEEDS_TARGET' }, { status: 400 })
    }
    if (relationEntity === parsed.data.entity) {
      return Response.json({ error: 'RELATION_SELF' }, { status: 400 })
    }
  }

  let key = slugifyFieldKey(parsed.data.label) || 'campo'
  // Garante unicidade dentro do (workspace, entity)
  const existing = await prisma.customFieldDefinition.findMany({
    where: { workspaceId: wsId, entity: parsed.data.entity, key: { startsWith: key } },
    select: { key: true },
  })
  const taken = new Set(existing.map((e) => e.key))
  if (taken.has(key)) {
    let n = 2
    while (taken.has(`${key}_${n}`)) n++
    key = `${key}_${n}`
  }

  const created = await prisma.customFieldDefinition.create({
    data: {
      workspaceId: wsId,
      entity: parsed.data.entity,
      key,
      label: parsed.data.label.trim(),
      type: parsed.data.type,
      required: parsed.data.required ?? false,
      helpText: parsed.data.helpText?.trim() || null,
      options: parsed.data.type === 'SELECT' ? options : [],
      relationEntity: parsed.data.type === 'RELATION' ? relationEntity : null,
      order: parsed.data.order ?? 0,
      createdById: auth.user.id,
      updatedById: auth.user.id,
    },
    select: DEF_SELECT,
  })

  await prisma.auditEvent.create({
    data: {
      workspaceId: wsId,
      category: 'PERMISSIONS',
      action: 'CREATE',
      actorUserId: auth.user.id,
      entityType: 'CustomFieldDefinition',
      entityId: created.id,
      summary: `CREATE custom field ${parsed.data.entity}.${key}`,
      meta: { entity: parsed.data.entity, type: parsed.data.type },
    },
    select: { id: true },
  })

  return Response.json({ definition: created }, { status: 201 })
}
