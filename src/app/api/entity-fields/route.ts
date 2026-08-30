import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'
import {
  assertEntityRecordInWorkspace,
  getCustomFieldEntity,
  isCustomFieldEntity,
} from '@/lib/custom-fields/registry'
import { getNativeFieldViews } from '@/lib/custom-fields/entity-field-config'
import { validateCustomFieldValues } from '@/lib/custom-fields/field-types'

type OutField = {
  source: 'native' | 'custom'
  key: string
  label: string
  kind: string
  editable: boolean
  required: boolean
  options: string[]
  helpText: string | null
  value: unknown
}

async function loadRecord(model: string, entityId: string, workspaceId: string) {
  const delegate = (prisma as unknown as Record<string, { findFirst: (a: unknown) => Promise<Record<string, unknown> | null> }>)[model]
  return delegate.findFirst({ where: { id: entityId, workspaceId } })
}

function nativeValueOut(kind: string, raw: unknown) {
  if (raw == null) return null
  if (kind === 'date') return raw instanceof Date ? raw.toISOString().slice(0, 10) : String(raw).slice(0, 10)
  if (kind === 'number' || kind === 'currency') return Number(raw)
  if (kind === 'boolean') return Boolean(raw)
  return typeof raw === 'object' ? raw : String(raw)
}

export async function GET(req: Request) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  const url = new URL(req.url)
  const entity = (url.searchParams.get('entity') ?? '').trim()
  const entityId = (url.searchParams.get('entityId') ?? '').trim()
  if (!isCustomFieldEntity(entity)) return Response.json({ error: 'INVALID_ENTITY' }, { status: 400 })

  const def = getCustomFieldEntity(entity)!
  const [{ scalars }, customDefs, record] = await Promise.all([
    getNativeFieldViews(wsId, entity),
    prisma.customFieldDefinition.findMany({
      where: { workspaceId: wsId, entity, active: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, key: true, label: true, type: true, required: true, options: true, helpText: true },
    }),
    entityId ? loadRecord(def.model, entityId, wsId) : Promise.resolve(null),
  ])

  const customValues = entityId
    ? await prisma.customFieldValue.findMany({
        where: { workspaceId: wsId, entityId, field: { entity } },
        select: { fieldId: true, value: true },
      })
    : []
  const valueByFieldId = new Map(customValues.map((v) => [v.fieldId, v.value]))

  const fields: OutField[] = [
    ...scalars
      .filter((f) => f.visible)
      .map((f) => ({
        source: 'native' as const,
        key: f.name,
        label: f.label,
        kind: f.kind,
        editable: f.editable,
        required: f.required && !f.system,
        options: f.enumValues ?? [],
        helpText: null,
        value: record ? nativeValueOut(f.kind, record[f.name]) : null,
      })),
    ...customDefs.map((d) => ({
      source: 'custom' as const,
      key: `cf:${d.key}`,
      label: d.label,
      kind: d.type.toLowerCase(),
      editable: true,
      required: d.required,
      options: d.options,
      helpText: d.helpText,
      value: valueByFieldId.get(d.id) ?? null,
    })),
  ]

  return Response.json({ fields })
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
  const { entity, entityId } = parsed.data
  if (!isCustomFieldEntity(entity)) return Response.json({ error: 'INVALID_ENTITY' }, { status: 400 })

  const inWs = await assertEntityRecordInWorkspace(entity, entityId, wsId)
  if (!inWs) return Response.json({ error: 'RECORD_NOT_FOUND' }, { status: 404 })

  const def = getCustomFieldEntity(entity)!
  const { scalars } = await getNativeFieldViews(wsId, entity)
  const editableNative = new Map(scalars.filter((f) => f.editable).map((f) => [f.name, f]))

  // Separa entradas nativas (chave crua) de personalizadas (prefixo cf:)
  const nativeInput: Record<string, unknown> = {}
  const customInput: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(parsed.data.values)) {
    if (k.startsWith('cf:')) customInput[k.slice(3)] = v
    else nativeInput[k] = v
  }

  const errors: Record<string, string> = {}

  // --- nativos editáveis ---
  const nativeData: Record<string, unknown> = {}
  for (const [name, rawVal] of Object.entries(nativeInput)) {
    const f = editableNative.get(name)
    if (!f) {
      errors[name] = 'NOT_EDITABLE'
      continue
    }
    if (rawVal === '' || rawVal === null || rawVal === undefined) {
      if (f.required) errors[name] = 'REQUIRED'
      else nativeData[name] = null
      continue
    }
    if (f.kind === 'text') nativeData[name] = String(rawVal).trim()
    else if (f.kind === 'number' || f.kind === 'currency') {
      const n = Number(String(rawVal).replace(',', '.'))
      if (!Number.isFinite(n)) errors[name] = 'NOT_A_NUMBER'
      else nativeData[name] = n
    } else if (f.kind === 'boolean') nativeData[name] = Boolean(rawVal)
    else if (f.kind === 'date') {
      const d = new Date(String(rawVal))
      if (Number.isNaN(d.getTime())) errors[name] = 'NOT_A_DATE'
      else nativeData[name] = d
    } else errors[name] = 'UNSUPPORTED'
  }

  // --- personalizados ---
  const customDefs = await prisma.customFieldDefinition.findMany({
    where: { workspaceId: wsId, entity, active: true },
    select: { id: true, key: true, label: true, type: true, required: true, options: true },
  })
  const customResult = validateCustomFieldValues(customDefs, customInput)
  if (!customResult.ok) {
    for (const [k, e] of Object.entries(customResult.errors)) errors[`cf:${k}`] = e
  }

  if (Object.keys(errors).length) return Response.json({ error: 'VALIDATION', errors }, { status: 400 })

  const ops: Array<Promise<unknown>> = []
  if (Object.keys(nativeData).length) {
    const delegate = (prisma as unknown as Record<string, { updateMany: (a: unknown) => Promise<unknown> }>)[def.model]
    ops.push(delegate.updateMany({ where: { id: entityId, workspaceId: wsId }, data: { ...nativeData, updatedById: auth.user.id } }))
  }
  if (customResult.ok) {
    const defByKey = new Map(customDefs.map((d) => [d.key, d]))
    for (const [k, value] of Object.entries(customResult.values)) {
      const d = defByKey.get(k)!
      if (value === null || value === undefined) {
        ops.push(prisma.customFieldValue.deleteMany({ where: { fieldId: d.id, entityId } }))
      } else {
        ops.push(
          prisma.customFieldValue.upsert({
            where: { fieldId_entityId: { fieldId: d.id, entityId } },
            update: { value: value as never, updatedById: auth.user.id },
            create: { workspaceId: wsId, fieldId: d.id, entityId, value: value as never, createdById: auth.user.id, updatedById: auth.user.id },
            select: { id: true },
          }),
        )
      }
    }
  }

  await prisma.$transaction(ops as never)
  return Response.json({ ok: true })
}
