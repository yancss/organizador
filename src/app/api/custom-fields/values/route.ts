import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'
import { assertEntityRecordInWorkspace, isCustomFieldEntity } from '@/lib/custom-fields/registry'
import { validateCustomFieldValues } from '@/lib/custom-fields/field-types'

export async function GET(req: Request) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  const url = new URL(req.url)
  const entity = (url.searchParams.get('entity') ?? '').trim()
  const entityId = (url.searchParams.get('entityId') ?? '').trim()
  if (!isCustomFieldEntity(entity)) return Response.json({ error: 'INVALID_ENTITY' }, { status: 400 })

  const defs = await prisma.customFieldDefinition.findMany({
    where: { workspaceId: wsId, entity, active: true },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, key: true, label: true, type: true, required: true, options: true, helpText: true },
  })

  const values = entityId
    ? await prisma.customFieldValue.findMany({
        where: { workspaceId: wsId, entityId, field: { entity } },
        select: { fieldId: true, value: true },
      })
    : []
  const byField = new Map(values.map((v) => [v.fieldId, v.value]))

  return Response.json({
    fields: defs.map((d) => ({ ...d, value: byField.get(d.id) ?? null })),
  })
}

const PutSchema = z.object({
  entity: z.string().min(1),
  entityId: z.string().min(1),
  values: z.record(z.string(), z.unknown()),
})

export async function PUT(req: Request) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  const body = await req.json().catch(() => null)
  const parsed = PutSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  if (!isCustomFieldEntity(parsed.data.entity)) return Response.json({ error: 'INVALID_ENTITY' }, { status: 400 })

  const inWorkspace = await assertEntityRecordInWorkspace(parsed.data.entity, parsed.data.entityId, wsId)
  if (!inWorkspace) return Response.json({ error: 'RECORD_NOT_FOUND' }, { status: 404 })

  const defs = await prisma.customFieldDefinition.findMany({
    where: { workspaceId: wsId, entity: parsed.data.entity, active: true },
    select: { id: true, key: true, label: true, type: true, required: true, options: true },
  })

  const result = validateCustomFieldValues(defs, parsed.data.values)
  if (!result.ok) return Response.json({ error: 'VALIDATION', errors: result.errors }, { status: 400 })

  const defByKey = new Map(defs.map((d) => [d.key, d]))
  const ops = Object.entries(result.values).map(([key, value]) => {
    const def = defByKey.get(key)!
    if (value === null || value === undefined) {
      return prisma.customFieldValue.deleteMany({ where: { fieldId: def.id, entityId: parsed.data.entityId } })
    }
    return prisma.customFieldValue.upsert({
      where: { fieldId_entityId: { fieldId: def.id, entityId: parsed.data.entityId } },
      update: { value: value as never, updatedById: auth.user.id },
      create: { workspaceId: wsId, fieldId: def.id, entityId: parsed.data.entityId, value: value as never, createdById: auth.user.id, updatedById: auth.user.id },
      select: { id: true },
    })
  })

  await prisma.$transaction(ops)

  const values = await prisma.customFieldValue.findMany({
    where: { workspaceId: wsId, entityId: parsed.data.entityId, field: { entity: parsed.data.entity } },
    select: { fieldId: true, value: true },
  })
  const byField = new Map(values.map((v) => [v.fieldId, v.value]))

  return Response.json({ fields: defs.map((d) => ({ id: d.id, key: d.key, value: byField.get(d.id) ?? null })) })
}
