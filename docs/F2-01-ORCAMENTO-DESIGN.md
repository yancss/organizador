# F2-01 / F2-02 — Orçamento (Proposta comercial) — Desenho

Data: 2026-08-29
Origem: `docs/ERP-VALIDACAO-E2E-2026-08-29.md` (G4) + `docs/ERP-BACKLOG-MESTRE-2026-06-14.md` (Fase 2)

## Problema

Hoje o "orçamento" não é uma entidade: é um `SalesOrder` nos status pré-confirmação
(`DRAFT/SENT/APPROVED/REJECTED/EXPIRED`). Isso mistura o ciclo comercial (proposta) com o
ciclo de execução (pedido), não tem numeração própria, nem trilha de conversão, nem data
de validade. Decisão (2026-08-29): **implementar entidade separada**.

## Escopo desta rodada

- **F2-01**: entidade `SalesQuote` + `SalesQuoteItem`, CRUD, ciclo de vida, tela.
- **F2-02**: conversão `Orçamento APROVADO -> Pedido de venda` com trilha de auditoria.

Fora de escopo (fases seguintes): tabela de preço (F2-03), condições de pagamento (F2-04),
política de desconto / aprovação por alçada no orçamento (F2-05), histórico comercial (F2-06),
pós-venda (F2-07). Auto-expiração por cron também fica para depois.

## Domínio

### `SalesQuote`
Espelha a estrutura de precificação do `SalesOrder` (cliente, itens, desconto no subtotal ou
por item, valor final) + campos próprios de proposta.

| Campo | Tipo | Nota |
|---|---|---|
| `id` | cuid | |
| `workspaceId` | FK | scoping obrigatório |
| `code` | `ORC-0000000001` | sequência atômica por workspace (`WorkspaceSequence` key `salesQuote`) |
| `ownerId` | FK User | dono comercial |
| `clientId` | FK Client? | |
| `name` | string | |
| `observations` | string? | |
| `status` | `SalesQuoteStatus` | ver abaixo |
| `validUntil` | DateTime? | data de validade da proposta |
| `discountMode` / `discountType` / `discountValue` / `discountPercent` | idem `SalesOrder` | |
| `value` | Decimal? | total (subtotal - desconto), via `calcOrderTotals` (reaproveitado) |
| `sentAt` | DateTime? | quando foi para `SENT` |
| `decidedAt` / `decidedById` | | quando/quem marcou `APPROVED`/`REJECTED` |
| `convertedAt` | DateTime? | |
| `salesOrderId` | FK SalesOrder? | pedido gerado na conversão |
| `createdById` / `updatedById` / `createdAt` / `updatedAt` | | padrão do projeto |

Índices: `[workspaceId]`, `[workspaceId, code]` unique, `[clientId]`, `[ownerId]`, `[status]`, `[validUntil]`.

### `SalesQuoteItem`
Igual a `SalesOrderItem` (`quantity`, `unitPrice`, desconto por item opcional), `@@unique([salesQuoteId, productId])`.
Só produtos `FINISHED` (mesma regra do pedido).

### enum `SalesQuoteStatus`
`DRAFT`, `SENT`, `APPROVED`, `REJECTED`, `EXPIRED`, `CONVERTED`, `CANCELLED`

Transições (`src/lib/sales/sales-quote-status.ts`, no mesmo padrão de `sales-order-status.ts`):

```
DRAFT      -> SENT, CANCELLED
SENT       -> APPROVED, REJECTED, EXPIRED, DRAFT, CANCELLED
APPROVED   -> CONVERTED, EXPIRED, CANCELLED
REJECTED   -> DRAFT, CANCELLED
EXPIRED    -> DRAFT, CANCELLED
CONVERTED  -> (terminal)
CANCELLED  -> (terminal)
```

### `SalesOrder` (mudança mínima)
- Novo campo `quoteId String?` + relação `quote SalesQuote?` (nullable, `onDelete: SetNull`).
- O enum `SalesOrderStatus` **não muda** (evita migração de dados e risco). Os status
  `SENT/APPROVED/REJECTED/EXPIRED` do pedido passam a ser legado; o fluxo novo é
  `orçamento -> pedido` e o pedido nasce em `DRAFT`.

## Regras de negócio

1. **Criar/editar**: só em `DRAFT`. Depois de `SENT`, itens/preços ficam imutáveis (editar exige voltar para `DRAFT`).
2. **Enviar** (`DRAFT -> SENT`): grava `sentAt`. (Envio de e-mail ao cliente = fase posterior; por ora só muda status.)
3. **Aprovar / Rejeitar** (`SENT -> APPROVED/REJECTED`): decisão comercial manual do usuário; grava `decidedAt`/`decidedById`. Sem `ApprovalRequest` por alçada nesta rodada (isso é F2-05).
4. **Expirar**: manual (`marcar como expirado`) a partir de `SENT`/`APPROVED`. Sugestão de expiração quando `validUntil < hoje` fica só como aviso na UI.
5. **Converter** (`APPROVED -> CONVERTED`), F2-02:
   - Cria `SalesOrder` com `status = DRAFT`, copiando `name`, `clientId`, `observations`, itens e configuração de desconto; `value` = total do orçamento; `quoteId` = orçamento de origem.
   - Marca o orçamento `CONVERTED` + `convertedAt` + `salesOrderId`.
   - `AuditEvent` dos dois lados (`STATUS SalesQuote -> CONVERTED`, `SalesOrder criado a partir de orçamento`).
   - Idempotente: se já `CONVERTED`, devolve o pedido existente sem criar outro.
   - O pedido entra em `DRAFT` de propósito: ao confirmar, ainda passa pelo gate de desconto (G3/G7). Assim não há dupla governança conflitante agora; F2-05 unifica.
6. **Cancelar**: de qualquer status não-terminal.
7. Toda operação: scoping por `workspaceId`, `AuditEvent` nos pontos sensíveis, listas paginadas.

## API

| Método | Rota | Ação |
|---|---|---|
| GET | `/api/quotes` | lista paginada (filtros: status, cliente, texto) |
| POST | `/api/quotes` | cria (status inicial `DRAFT`) |
| GET | `/api/quotes/[id]` | detalhe |
| PATCH | `/api/quotes/[id]` | edita campos / itens / muda status (valida transição) |
| DELETE | `/api/quotes/[id]` | remove (só `DRAFT`/`CANCELLED`) |
| POST | `/api/quotes/[id]/convert` | F2-02 — gera o `SalesOrder` |

Permissão: módulo `sales` (mesmo do pedido de venda). `requireWorkspace`.

## UI

- Nav: novo item **"Orçamentos"** em Vendas -> `/app/sales/quotes` (antes de "Pedidos de venda").
- Tela: lista (`DataTable`) + painel de criação/edição reaproveitando os blocos de item/preço/desconto do `order-board`. Não é kanban — é lista + formulário, mais simples.
- Ações por linha conforme o status: Enviar, Aprovar, Rejeitar, Marcar expirado, **Converter em pedido**, Cancelar.
- Badge de validade vencida quando `validUntil < hoje`.
- Após converter: link para o pedido gerado.
- i18n pt/es/en (padrão inline das telas novas).

## Migração

Aditiva: `CREATE TABLE "SalesQuote"`, `"SalesQuoteItem"`, `CREATE TYPE "SalesQuoteStatus"`,
`ALTER TABLE "SalesOrder" ADD COLUMN "quoteId"`. Sem backfill.

## Testes

- `sales-quote-status.test.ts` — matriz de transição.
- `sales-quote-totals` — reaproveita `calcOrderTotals` (já testado); teste de fumaça da cópia na conversão.
- Teste de página da lista de orçamentos (padrão dos outros `*.page.test.tsx`).
- Validação E2E manual: criar -> enviar -> aprovar -> converter -> confirmar o pedido.

## Ordem de implementação

1. schema + migration + `sales-quote-status.ts` (+ teste)
2. code gen `QUO-` (`WorkspaceSequence`)
3. API `/api/quotes` + `/api/quotes/[id]`
4. API `/api/quotes/[id]/convert` (F2-02)
5. nav + tela `/app/sales/quotes` + i18n
6. testes + validação E2E + doc de status

## Implementado (2026-08-29)

Decisões aplicadas: código **`QUO-0000000001`**; conversão gera pedido em **DRAFT**;
inclui **F2-05 parcial** (aprovação de desconto no orçamento).

- Migration `20260829201522_comercial_orcamento_proposta`: `SalesQuote`, `SalesQuoteItem`,
  enum `SalesQuoteStatus`, `ApprovalEntityType += SALES_QUOTE`, `ApprovalRequest.salesQuoteId`.
  - **A FK ficou em `SalesQuote.salesOrderId`** (não `SalesOrder.quoteId`): o orçamento
    aponta para o pedido gerado; `SalesOrder.sourceQuote` é a relação inversa 1:1.
- `src/lib/sales/sales-quote-status.ts` (+ `.test.ts`), `sales-quote-codes.ts`,
  `sales-item-normalization.ts` (compartilhado com pedido de venda).
- API: `GET/POST /api/quotes`, `GET/PATCH/DELETE /api/quotes/[id]`, `POST /api/quotes/[id]/convert`.
- F2-05 parcial: transição `-> APPROVED` com desconto acima da política cria `ApprovalRequest`
  (`SALES_QUOTE_DISCOUNT`) e devolve `409 APPROVAL_REQUIRED`. Aprovar essa solicitação
  auto-avança o orçamento para `APPROVED` e notifica o solicitante (via `applyApprovalOutcome`, G7).
- UI: aba **Orçamentos** em Vendas (`/app/sales/quotes`), lista + formulário, pt/es/en.
- Não mexeu no `SalesOrderStatus` nem no board de pedidos.

Pendente da Fase 2: F2-03 (tabela de preço), F2-04 (condições de pagamento), F2-05 completo
(matriz de alçada comercial), F2-06 (histórico comercial), F2-07 (pós-venda). Auto-expiração
de orçamento por cron também fica para depois (hoje é manual + aviso na UI).
