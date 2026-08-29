import { prisma } from '@/lib/prisma'

/**
 * Objetos do sistema que aceitam campos personalizados.
 *
 * Não é "toda tabela do banco" — são os registros de negócio que o usuário
 * cria/edita. Tabelas de junção, movimentos, auditoria, auth, filas e settings
 * ficam de fora de propósito. Adicionar um novo objeto aqui é só incluir uma
 * entrada (nenhuma migração necessária: a definição guarda `entity` como string).
 */
export type CustomFieldEntityKey =
  | 'SALES_QUOTE'
  | 'SALES_ORDER'
  | 'PURCHASE_ORDER'
  | 'PURCHASE'
  | 'CLIENT'
  | 'PRODUCT'
  | 'INVENTORY'
  | 'WAREHOUSE'
  | 'INVENTORY_LOT'
  | 'RECIPE'
  | 'DELIVERY'
  | 'RECEIVABLE'
  | 'PAYABLE'
  | 'PAYMENT'
  | 'REFUND'
  | 'FINANCIAL_ENTRY'
  | 'FINANCIAL_ACCOUNT'
  | 'FINANCIAL_CATEGORY'
  | 'COST_CENTER'
  | 'COMPANY'
  | 'COMPANY_BRANCH'
  | 'FISCAL_DOCUMENT'

type EntityDef = {
  key: CustomFieldEntityKey
  /** Nome do model no Prisma Client (para checar ownership do registro). */
  model:
    | 'salesQuote'
    | 'salesOrder'
    | 'purchaseOrder'
    | 'purchase'
    | 'client'
    | 'product'
    | 'inventory'
    | 'warehouse'
    | 'inventoryLot'
    | 'recipe'
    | 'delivery'
    | 'receivable'
    | 'payable'
    | 'payment'
    | 'refund'
    | 'financialEntry'
    | 'financialAccount'
    | 'financialCategory'
    | 'costCenter'
    | 'company'
    | 'companyBranch'
    | 'fiscalDocument'
  /** Campo do model que aponta o registro para o workspace. */
  ownerField: 'workspaceId' | 'productId'
  labels: { pt: string; es: string; en: string }
  /** Grupo para agrupar na UI. */
  group: 'commercial' | 'purchasing' | 'catalog' | 'inventory' | 'logistics' | 'finance' | 'fiscal'
}

export const CUSTOM_FIELD_ENTITIES: EntityDef[] = [
  { key: 'SALES_QUOTE', model: 'salesQuote', ownerField: 'workspaceId', group: 'commercial', labels: { pt: 'Orçamento', es: 'Presupuesto', en: 'Quote' } },
  { key: 'SALES_ORDER', model: 'salesOrder', ownerField: 'workspaceId', group: 'commercial', labels: { pt: 'Pedido de venda', es: 'Pedido de venta', en: 'Sales order' } },
  { key: 'PURCHASE_ORDER', model: 'purchaseOrder', ownerField: 'workspaceId', group: 'purchasing', labels: { pt: 'Pedido de compra', es: 'Pedido de compra', en: 'Purchase order' } },
  { key: 'PURCHASE', model: 'purchase', ownerField: 'workspaceId', group: 'purchasing', labels: { pt: 'Compra direta', es: 'Compra directa', en: 'Direct purchase' } },
  { key: 'CLIENT', model: 'client', ownerField: 'workspaceId', group: 'commercial', labels: { pt: 'Cliente / Fornecedor', es: 'Cliente / Proveedor', en: 'Client / Supplier' } },
  { key: 'PRODUCT', model: 'product', ownerField: 'workspaceId', group: 'catalog', labels: { pt: 'Produto', es: 'Producto', en: 'Product' } },
  { key: 'INVENTORY', model: 'inventory', ownerField: 'workspaceId', group: 'inventory', labels: { pt: 'Estoque (item)', es: 'Inventario (ítem)', en: 'Inventory (item)' } },
  { key: 'WAREHOUSE', model: 'warehouse', ownerField: 'workspaceId', group: 'inventory', labels: { pt: 'Armazém', es: 'Almacén', en: 'Warehouse' } },
  { key: 'INVENTORY_LOT', model: 'inventoryLot', ownerField: 'workspaceId', group: 'inventory', labels: { pt: 'Lote de estoque', es: 'Lote de inventario', en: 'Inventory lot' } },
  { key: 'RECIPE', model: 'recipe', ownerField: 'workspaceId', group: 'catalog', labels: { pt: 'Receita', es: 'Receta', en: 'Recipe' } },
  { key: 'DELIVERY', model: 'delivery', ownerField: 'workspaceId', group: 'logistics', labels: { pt: 'Entrega', es: 'Entrega', en: 'Delivery' } },
  { key: 'RECEIVABLE', model: 'receivable', ownerField: 'workspaceId', group: 'finance', labels: { pt: 'Recebível', es: 'Cobro', en: 'Receivable' } },
  { key: 'PAYABLE', model: 'payable', ownerField: 'workspaceId', group: 'finance', labels: { pt: 'Conta a pagar', es: 'Cuenta a pagar', en: 'Payable' } },
  { key: 'PAYMENT', model: 'payment', ownerField: 'workspaceId', group: 'finance', labels: { pt: 'Pagamento', es: 'Pago', en: 'Payment' } },
  { key: 'REFUND', model: 'refund', ownerField: 'workspaceId', group: 'finance', labels: { pt: 'Devolução', es: 'Devolución', en: 'Refund' } },
  { key: 'FINANCIAL_ENTRY', model: 'financialEntry', ownerField: 'workspaceId', group: 'finance', labels: { pt: 'Lançamento financeiro', es: 'Asiento financiero', en: 'Financial entry' } },
  { key: 'FINANCIAL_ACCOUNT', model: 'financialAccount', ownerField: 'workspaceId', group: 'finance', labels: { pt: 'Conta financeira', es: 'Cuenta financiera', en: 'Financial account' } },
  { key: 'FINANCIAL_CATEGORY', model: 'financialCategory', ownerField: 'workspaceId', group: 'finance', labels: { pt: 'Categoria financeira', es: 'Categoría financiera', en: 'Financial category' } },
  { key: 'COST_CENTER', model: 'costCenter', ownerField: 'workspaceId', group: 'finance', labels: { pt: 'Centro de custo', es: 'Centro de costo', en: 'Cost center' } },
  { key: 'COMPANY', model: 'company', ownerField: 'workspaceId', group: 'fiscal', labels: { pt: 'Empresa', es: 'Empresa', en: 'Company' } },
  { key: 'COMPANY_BRANCH', model: 'companyBranch', ownerField: 'workspaceId', group: 'fiscal', labels: { pt: 'Filial', es: 'Sucursal', en: 'Branch' } },
  { key: 'FISCAL_DOCUMENT', model: 'fiscalDocument', ownerField: 'workspaceId', group: 'fiscal', labels: { pt: 'Documento fiscal', es: 'Documento fiscal', en: 'Fiscal document' } },
]

const BY_KEY = new Map(CUSTOM_FIELD_ENTITIES.map((e) => [e.key, e]))

export function isCustomFieldEntity(key: string): key is CustomFieldEntityKey {
  return BY_KEY.has(key as CustomFieldEntityKey)
}

export function getCustomFieldEntity(key: string): EntityDef | null {
  return BY_KEY.get(key as CustomFieldEntityKey) ?? null
}

export function entityLabel(key: string, language: string): string {
  const def = getCustomFieldEntity(key)
  if (!def) return key
  return language === 'pt' ? def.labels.pt : language === 'es' ? def.labels.es : def.labels.en
}

/** Confirma que o registro existe e pertence ao workspace. */
export async function assertEntityRecordInWorkspace(entity: CustomFieldEntityKey, entityId: string, workspaceId: string) {
  const def = getCustomFieldEntity(entity)
  if (!def) return false
  const delegate = (prisma as unknown as Record<string, { findFirst: (args: unknown) => Promise<{ id: string } | null> }>)[def.model]
  const where = def.ownerField === 'productId' ? { productId: entityId, workspaceId } : { id: entityId, workspaceId }
  const found = await delegate.findFirst({ where, select: { id: true } })
  return !!found
}
