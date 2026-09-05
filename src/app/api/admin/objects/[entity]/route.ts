import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/authz'
import { getCustomFieldEntity, isCustomFieldEntity } from '@/lib/custom-fields/registry'
import { getNativeFieldViews } from '@/lib/custom-fields/entity-field-config'
import { getEntityDisplay } from '@/lib/custom-fields/entity-config'

/** Ficha completa de um objeto: campos nativos (somente leitura) + campos personalizados. */
export async function GET(_req: Request, ctx: { params: Promise<{ entity: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { entity } = await ctx.params
  if (!isCustomFieldEntity(entity)) return Response.json({ error: 'INVALID_ENTITY' }, { status: 404 })

  const def = getCustomFieldEntity(entity)!
  const [native, display] = await Promise.all([
    getNativeFieldViews(auth.user.workspaceId, entity),
    getEntityDisplay(auth.user.workspaceId, entity),
  ])

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
      relationEntity: true,
      _count: { select: { values: true } },
    },
  })

  return Response.json({
    entity: def.key,
    group: def.group,
    labels: def.labels,
    configuredLabel: display.configuredLabel,
    description: display.description,
    native,
    custom,
  })
}

const PatchSchema = z.object({
  label: z.string().max(120).optional().nullable(),
  description: z.string().max(400).optional().nullable(),
})

/** Ajusta o nome de exibição e a descrição do objeto (por workspace). */
export async function PATCH(req: Request, ctx: { params: Promise<{ entity: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { entity } = await ctx.params
  if (!isCustomFieldEntity(entity)) return Response.json({ error: 'INVALID_ENTITY' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })

  const wsId = auth.user.workspaceId
  const label = parsed.data.label === undefined ? undefined : parsed.data.label?.trim() || null
  const description = parsed.data.description === undefined ? undefined : parsed.data.description?.trim() || null

  const updated = await prisma.entityConfig.upsert({
    where: { workspaceId_entity: { workspaceId: wsId, entity } },
    update: {
      ...(label !== undefined ? { label } : {}),
      ...(description !== undefined ? { description } : {}),
      updatedById: auth.user.id,
    },
    create: {
      workspaceId: wsId,
      entity,
      label: label ?? null,
      description: description ?? null,
      updatedById: auth.user.id,
    },
    select: { label: true, description: true },
  })

  await prisma.auditEvent.create({
    data: {
      workspaceId: wsId,
      category: 'PERMISSIONS',
      action: 'UPDATE',
      actorUserId: auth.user.id,
      entityType: 'EntityConfig',
      entityId: entity,
      summary: `UPDATE object display ${entity}`,
      meta: { entity },
    },
    select: { id: true },
  })

  return Response.json({ configuredLabel: updated.label, description: updated.description })
}
