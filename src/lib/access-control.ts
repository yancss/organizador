export const ROLE_PERMISSION_MODULES = ['sales', 'purchases', 'inventory', 'products', 'clients', 'finance', 'workflow'] as const

export type RolePermissionModule = (typeof ROLE_PERMISSION_MODULES)[number]

export type AccessRequirement =
  | { kind: 'admin' }
  | { kind: 'module'; module: RolePermissionModule }

export const ENTITY_TYPE_MODULE: Record<string, RolePermissionModule> = {
  SalesOrder: 'sales',
  Delivery: 'sales',
  Receivable: 'finance',
  Payment: 'finance',
  Refund: 'finance',
  Payable: 'finance',
  PurchaseOrder: 'purchases',
  Inventory: 'inventory',
  InventoryMovement: 'inventory',
  InventoryTransfer: 'inventory',
  Warehouse: 'inventory',
  Product: 'products',
  ProductBarcode: 'products',
  Recipe: 'products',
  Client: 'clients',
  FinancialEntry: 'finance',
  FinancialAccount: 'finance',
  FinancialCategory: 'finance',
  CostCenter: 'finance',
  ApprovalRequest: 'workflow',
}

export const LOOKUP_MODEL_MODULE: Record<string, RolePermissionModule> = {
  Product: 'products',
  Client: 'clients',
  FinancialAccount: 'finance',
  FinancialCategory: 'finance',
  CostCenter: 'finance',
}

const ROUTE_ACCESS_RULES: Array<{ prefix: string; access: AccessRequirement }> = [
  { prefix: '/app/admin', access: { kind: 'admin' } },
  { prefix: '/app/finance', access: { kind: 'module', module: 'finance' } },
  { prefix: '/app/payments', access: { kind: 'module', module: 'finance' } },
  { prefix: '/app/receivables', access: { kind: 'module', module: 'finance' } },
  { prefix: '/app/refunds', access: { kind: 'module', module: 'finance' } },
  { prefix: '/app/costs', access: { kind: 'module', module: 'finance' } },
  { prefix: '/app/sales', access: { kind: 'module', module: 'sales' } },
  { prefix: '/app/history', access: { kind: 'module', module: 'sales' } },
  { prefix: '/app/deliveries', access: { kind: 'module', module: 'sales' } },
  { prefix: '/app/purchases', access: { kind: 'module', module: 'purchases' } },
  { prefix: '/app/inventory', access: { kind: 'module', module: 'inventory' } },
  { prefix: '/app/products', access: { kind: 'module', module: 'products' } },
  { prefix: '/app/recipes', access: { kind: 'module', module: 'products' } },
  { prefix: '/app/clients', access: { kind: 'module', module: 'clients' } },
  { prefix: '/app/workflow', access: { kind: 'module', module: 'workflow' } },

  { prefix: '/api/admin', access: { kind: 'admin' } },
  { prefix: '/api/finance', access: { kind: 'module', module: 'finance' } },
  { prefix: '/api/payables', access: { kind: 'module', module: 'finance' } },
  { prefix: '/api/payments', access: { kind: 'module', module: 'finance' } },
  { prefix: '/api/receivables', access: { kind: 'module', module: 'finance' } },
  { prefix: '/api/refunds', access: { kind: 'module', module: 'finance' } },
  { prefix: '/api/events', access: { kind: 'module', module: 'sales' } },
  { prefix: '/api/tasks', access: { kind: 'module', module: 'sales' } },
  { prefix: '/api/orders', access: { kind: 'module', module: 'sales' } },
  { prefix: '/api/deliveries', access: { kind: 'module', module: 'sales' } },
  { prefix: '/api/purchase-orders', access: { kind: 'module', module: 'purchases' } },
  { prefix: '/api/purchases', access: { kind: 'module', module: 'purchases' } },
  { prefix: '/api/production', access: { kind: 'module', module: 'inventory' } },
  { prefix: '/api/inventory', access: { kind: 'module', module: 'inventory' } },
  { prefix: '/api/warehouses', access: { kind: 'module', module: 'inventory' } },
  { prefix: '/api/products', access: { kind: 'module', module: 'products' } },
  { prefix: '/api/recipes', access: { kind: 'module', module: 'products' } },
  { prefix: '/api/clients', access: { kind: 'module', module: 'clients' } },
  { prefix: '/api/approvals', access: { kind: 'module', module: 'workflow' } },
]

export function getRouteAccessRequirement(pathname: string) {
  return ROUTE_ACCESS_RULES.find((rule) => pathname.startsWith(rule.prefix))?.access ?? null
}
