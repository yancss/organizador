# Modelo de dados (após split Event → SalesOrder/PurchaseOrder) — 2026-03-11

Fonte: `prisma/schema.prisma`

## Tabelas principais

### Comercial
- **SalesOrder**
  - workspaceId, ownerId, clientId?
  - name, observations?
  - orderedAt?, deliveryAt?
  - status: DRAFT | CONFIRMED | IN_PRODUCTION | READY | SHIPPED | DONE | CANCELLED
  - value?
- **SalesOrderItem**
  - salesOrderId, productId, quantity

### Compras
- **PurchaseOrder**
  - workspaceId
  - supplier? (texto)
  - orderedAt?
  - status: DRAFT | CONFIRMED | RECEIVED | CANCELLED
  - estimatedCost?
  - observations?
- **PurchaseOrderItem**
  - purchaseOrderId, productId, quantity

### Ajustes de relacionamento já feitos
- **FinancialEntry** agora referencia **salesOrderId** (em vez de orderId)
- **Consumption** agora referencia **salesOrderId** (em vez de orderId)

## Observação
- As tabelas do fluxo de vendas já existem no schema atual: Delivery/Receivable/Payment/PaymentApplication/Refund.
- Ver também: `docs/data-model-sales-flow-v1.md`
