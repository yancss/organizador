import { Prisma } from '@prisma/client'

import { getCustomFieldEntity, type CustomFieldEntityKey } from './registry'

export type NativeField = {
  name: string
  /** Tipo amigável para exibição. */
  kind: 'text' | 'number' | 'currency' | 'boolean' | 'date' | 'enum' | 'json' | 'relation'
  /** Tipo cru do Prisma (String, Int, Decimal, DateTime, enum name, model name…). */
  rawType: string
  required: boolean
  list: boolean
  /** Campo de infraestrutura (id, workspace, auditoria) — some/agrupa na UI. */
  system: boolean
  /** Valores possíveis quando kind = enum. */
  enumValues?: string[]
  /** Sempre true: nativos não são editáveis como definição. */
  readOnly: true
}

const SYSTEM_FIELDS = new Set([
  'id',
  'workspaceId',
  'ownerId',
  'createdById',
  'updatedById',
  'createdAt',
  'updatedAt',
  'orderIndex',
])

// Campos "moeda" por convenção de nome (o Prisma não distingue Decimal-dinheiro de Decimal-quantidade).
const CURRENCY_HINT = /(cost|price|amount|value|total|paid|accrued|planned|balance|discountValue)/i

function friendlyKind(field: { kind: string; type: string; name: string }, enumNames: Set<string>): NativeField['kind'] {
  if (field.kind === 'object') return 'relation'
  if (field.kind === 'enum' || enumNames.has(field.type)) return 'enum'
  switch (field.type) {
    case 'String':
      return 'text'
    case 'Boolean':
      return 'boolean'
    case 'DateTime':
      return 'date'
    case 'Json':
      return 'json'
    case 'Int':
    case 'BigInt':
    case 'Float':
    case 'Decimal':
      return CURRENCY_HINT.test(field.name) ? 'currency' : 'number'
    default:
      return 'text'
  }
}

function dmmfModelName(prismaDelegate: string): string {
  return prismaDelegate.charAt(0).toUpperCase() + prismaDelegate.slice(1)
}

/**
 * Lê o schema do Prisma (DMMF) e devolve os campos nativos de um objeto do registry.
 * São mostrados para o admin, mas não podem ser alterados como definição.
 */
export function getNativeFields(entity: CustomFieldEntityKey): {
  scalars: NativeField[]
  relations: NativeField[]
} {
  const def = getCustomFieldEntity(entity)
  if (!def) return { scalars: [], relations: [] }

  const modelName = dmmfModelName(def.model)
  const model = Prisma.dmmf.datamodel.models.find((m) => m.name === modelName)
  if (!model) return { scalars: [], relations: [] }

  const enumsByName = new Map(Prisma.dmmf.datamodel.enums.map((e) => [e.name, e.values.map((v) => v.name)]))
  const enumNames = new Set(enumsByName.keys())

  const scalars: NativeField[] = []
  const relations: NativeField[] = []

  for (const f of model.fields) {
    const kind = friendlyKind(f, enumNames)
    const nf: NativeField = {
      name: f.name,
      kind,
      rawType: f.type,
      required: f.isRequired,
      list: f.isList,
      system: SYSTEM_FIELDS.has(f.name),
      enumValues: kind === 'enum' ? enumsByName.get(f.type) : undefined,
      readOnly: true,
    }
    if (kind === 'relation') relations.push(nf)
    else scalars.push(nf)
  }

  return { scalars, relations }
}
