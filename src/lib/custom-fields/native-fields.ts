import { Prisma } from '@prisma/client'

import { getCustomFieldEntity, type CustomFieldEntityKey } from './registry'

export type NativeField = {
  name: string
  /** Rótulo padrão (humanizado). O admin pode sobrescrever via EntityFieldConfig. */
  defaultLabel: string
  /** Tipo amigável para exibição. */
  kind: 'text' | 'number' | 'currency' | 'boolean' | 'date' | 'enum' | 'json' | 'relation'
  /** Tipo cru do Prisma (String, Int, Decimal, DateTime, enum name, model name…). */
  rawType: string
  required: boolean
  list: boolean
  /** Campo de infraestrutura (id, workspace, auditoria) — some/agrupa na UI. */
  system: boolean
  /** Pode ser marcado como editável na seção de processo. */
  editableEligible: boolean
  /** Valores possíveis quando kind = enum. */
  enumValues?: string[]
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

/**
 * Campos nativos que PODEM ser marcados como editáveis na seção de campos do processo.
 * Apenas escalares seguros (nomes, descrições, contato, endereço, datas de referência).
 * Nunca id/FK/status/valores calculados/timestamps de sistema.
 */
export const EDITABLE_NATIVE_FIELDS: Record<string, string[]> = {
  SALES_QUOTE: ['name', 'observations', 'validUntil'],
  SALES_ORDER: ['name', 'observations'],
  PURCHASE_ORDER: ['observations'],
  PURCHASE: ['observations'],
  CLIENT: [
    'name',
    'phone',
    'phoneCountry',
    'email',
    'birthDate',
    'idType',
    'idNumber',
    'idCountry',
    'addressCountry',
    'addressPostalCode',
    'addressState',
    'addressCity',
    'addressDistrict',
    'addressStreet',
    'addressNumber',
    'addressComplement',
    'observations',
  ],
  PRODUCT: ['name', 'brand'],
  INVENTORY: [],
  WAREHOUSE: ['name', 'code'],
  INVENTORY_LOT: ['notes'],
  RECIPE: ['name', 'notes'],
  DELIVERY: ['notes'],
  RECEIVABLE: ['notes'],
  PAYABLE: ['observations'],
  PAYMENT: ['notes'],
  REFUND: ['reason'],
  FINANCIAL_ENTRY: ['name', 'observations'],
  FINANCIAL_ACCOUNT: ['name'],
  FINANCIAL_CATEGORY: ['name'],
  COST_CENTER: ['name'],
  COMPANY: ['name'],
  COMPANY_BRANCH: ['name'],
  FISCAL_DOCUMENT: ['notes'],
}

export function isEditableEligible(entity: string, fieldName: string): boolean {
  return (EDITABLE_NATIVE_FIELDS[entity] ?? []).includes(fieldName)
}

/** Rótulo padrão: humaniza o nome do campo (camelCase -> "Camel case"). */
export function defaultFieldLabel(fieldName: string): string {
  const spaced = fieldName
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

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
      defaultLabel: defaultFieldLabel(f.name),
      kind,
      rawType: f.type,
      required: f.isRequired,
      list: f.isList,
      system: SYSTEM_FIELDS.has(f.name),
      editableEligible: kind !== 'relation' && isEditableEligible(entity, f.name),
      enumValues: kind === 'enum' ? enumsByName.get(f.type) : undefined,
    }
    if (kind === 'relation') relations.push(nf)
    else scalars.push(nf)
  }

  return { scalars, relations }
}
