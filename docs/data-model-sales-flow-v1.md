# Modelo de dados — Fluxo de Vendas v1 (PV → Entrega → Recebível → Pagamento/Aplicação → Devolução)

Data: 2026-03-11

## Objetivo
Implementar o fluxo que combinamos:
- PV confirmado (SalesOrder)
- Entrega/Expedição (Delivery)
- Recebível real nasce na **expedição**
- Pagamento antecipado vinculado ao PV
- Aplicação (conciliação) de pagamentos em recebíveis
- Devolução/estorno (cartão como primeira opção)

## Entidades

### SalesOrder (Pedido de Venda)
- status: DRAFT | CONFIRMED | IN_PRODUCTION | READY | SHIPPED | DONE | CANCELLED
- value: valor combinado (opcional)

### Delivery (Entrega/Expedição)
- status: PLANNED | PICKING | SHIPPED | DELIVERED | CANCELLED | RETURNED
- timestamps: plannedAt, shippedAt, deliveredAt
- logística: carrier, trackingCode/url
- **value**: valor a faturar nesta expedição (MVP)

### DeliveryItem
- deliveryId, productId, quantity

### Receivable (Contas a Receber Real)
- nasce por Delivery (deliveryId é **unique**)
- status: OPEN | PAID | CANCELLED
- datas: issuedAt, dueAt
- value

### Payment (Pagamento/Adiantamento)
- sempre vinculado ao **SalesOrder**
- method: CASH | TRANSFER | MBWAY | PIX | CARD | OTHER
- status: RECEIVED | REFUNDED | FAILED
- receivedAt, value

### PaymentApplication (Aplicação)
- liga Payment ↔ Receivable
- value aplicado

### Refund (Devolução/Estorno)
- method: CARD_REVERSAL | TRANSFER | PIX | MBWAY | CASH | OTHER
- status: REQUESTED | PROCESSING | DONE | FAILED
- pode apontar para paymentId (quando devolvendo um pagamento específico)

## Regras principais (implementação)
- Receivable real deve ser criado quando Delivery.status virar **SHIPPED**
- Pagamentos podem entrar antes do Receivable (adiantamento)
- Ao criar Receivable: aplicar automaticamente pagamentos RECEIVED do PV ainda não aplicados
- Devolução: criar Refund (preferir CARD_REVERSAL quando Payment.method=CARD)
