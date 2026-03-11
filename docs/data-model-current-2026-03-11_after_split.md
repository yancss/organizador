# Modelo de dados (após split Event → SalesOrder/PurchaseOrder) — 2026-03-11

Fonte: `prisma/schema.prisma`

## Tabelas principais

### Comercial
- **SalesOrder**
  - workspaceId, ownerId, clientId?
  - name, observations?
  - orderedAt?, deliveryAt?
  - status: DRAFT|CONFIRMED|CANCELLED
  - value?
- **SalesOrderItem**
  - salesOrderId, productId, quantity

### Compras
- **PurchaseOrder**
  - workspaceId
  - supplier? (texto)
  - orderedAt?
  - status: DRAFT|CONFIRMED|CANCELLED
  - estimatedCost?
  - observations?
- **PurchaseOrderItem**
  - purchaseOrderId, productId, quantity

### Ajustes de relacionamento já feitos
- **FinancialEntry** agora referencia **salesOrderId** (em vez de orderId)
- **Consumption** agora referencia **salesOrderId** (em vez de orderId)

## Observação
- Ainda não estão implementadas as tabelas do pacote novo: Delivery/Receivable/Payment/PaymentApplication/Refund.
