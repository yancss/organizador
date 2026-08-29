# Guardian - Validação ponta a ponta do ERP

Data: 2026-08-29
Branch: `develop`
Ambiente: dev-local (Postgres Docker `localhost:55432`, `guardian_dev`), auth desativada (`DISABLE_AUTH=1`)

## Contexto

Após o commit `57bcc80` ("feat: implementação do ERP"), foi feita uma validação ponta a ponta
dos fluxos novos contra o banco de dev (que já tinha dados de seed: 45 clientes, 18 produtos,
120 pedidos de venda, 80 de compra). Objetivo: confirmar que os ciclos entregues funcionam de
verdade e mapear lacunas antes de abrir novas frentes.

Não há dados reais/produção ainda. A migração de saldos existentes **não** é necessária agora;
a entrada de dados legados será tratada no futuro como **importação (JSON/planilha)**, não como
backfill de migração.

## Estado atual (pela documentação)

- **Fase 1 - Estoque rastreável: fechada.** F1-01 a F1-07 entregues: movimento de estoque
  explícito, lotes/validade/seriais, eventos de lote, armazéns + transferências, reserva por
  pedido, reposição com previsão e calendário do fornecedor, API e tela de rastreabilidade.
- **1ª camada** de Comercial (status de orçamento no próprio `SalesOrder`), Financeiro
  (`Payable` dedicado) e Workflow (`ApprovalRequest`).
- **Fases 2 a 6 e anexos:** não iniciadas de forma significativa.

## Resultado dos testes (todos aprovados)

| Fluxo | Verificação | Resultado |
|---|---|---|
| Alçada de compra | PO R$ 5.000 acima do limite | `approvalRequired=true`, status forçado a DRAFT, `ApprovalRequest` PENDING (policyKey `PURCHASE_ORDER_AMOUNT`) |
| Gate de compra | confirmar PO sem aprovação | HTTP 409 `APPROVAL_REQUIRED` |
| Alçada de compra | aprovar e confirmar | após `APPROVED`, `PATCH status=CONFIRMED` passa |
| Alçada de desconto | pedido de venda com 30% de desconto | `ApprovalRequest` `SALES_ORDER_DISCOUNT` (amount 150), pedido fica DRAFT |
| Gate de venda | confirmar pedido com desconto pendente | HTTP 409 `APPROVAL_REQUIRED` |
| Payable (planejado) | PO confirmado < alçada | `Payable` PLANNED com `plannedAmount` = custo estimado |
| Payable (acumulado) | após recebimento parcial | `Payable` ACCRUED, `accruedAmount` proporcional ao recebido |
| Recebimento parcial | receber 40 de 50 (35 aceito, 5 rejeitado) com lote e validade | status `PARTIALLY_RECEIVED`, divergência `REJECTED` registrada, pendência 10 |
| Movimento de estoque | após recebimento | `InventoryMovement` `PURCHASE_RECEIPT` +35, `balanceAfterGlobal` 138.202, `balanceAfterWarehouse` 35 |
| Lote | após recebimento com `lotCode` | `InventoryLot` criado (qty 35, validade, fornecedor, armazém), `InventoryLotEvent` `PURCHASE_RECEIPT` |
| Custo médio | após recebimento | `avgCost` recalculado 5,46 -> 6,61 (ponderado, correto) |
| Rastreabilidade | `GET /api/inventory/trace` e tela `/app/inventory/trace` | evento retorna lote, validade, armazém, documento de origem e observação |
| Reserva de estoque | confirmar pedido de venda | `reservedQty` no produto, `availableQty` = saldo - reservado |
| Reposição | configurar mínimo/alvo/fornecedor e consultar | item entra como `urgent`, `shortageQty` 261.8, `suggestedQty` 261.8, grupo consolidado por fornecedor |
| Rascunho de compra | `POST /api/purchase-orders/replenishment/draft` | PO DRAFT gerado a partir da reposição |

## Lacunas identificadas

### Entrada de dados legados (adiado - virar importação)

- **G1 - Sem carga inicial de saldo para armazém/lote.** Estoque criado antes das features de
  armazém/lote fica fora de `InventoryByWarehouse` e de qualquer `InventoryLot`. Só afeta bases
  com histórico. **Decisão 2026-08-29:** não tratar agora; quando houver importação de sistemas
  externos (JSON/planilha), a rotina de import deve popular depósito padrão + lote de abertura.
- **G2 - Sem histórico de movimento retroativo.** `InventoryMovement` só cobre operações novas.
  Mesma decisão de G1.

### A tratar - contra a diretriz do projeto

- **G3 - Alçadas hardcoded.** `src/lib/approval-policies.ts` fixa `PURCHASE_APPROVAL_THRESHOLD=1000`,
  `SALES_DISCOUNT_PERCENT_THRESHOLD=10`, `SALES_DISCOUNT_VALUE_THRESHOLD=200`. Os documentos
  (ERP-GAPS regra 6; ERP-EXECUTION-AGENTS Agente 4) pedem policy parametrizável por workspace.
  Ação: tabela `ApprovalPolicy` (ou config por workspace) com os limites, mantendo os valores
  atuais como default de fallback.

### A decidir - regra de negócio / arquitetura

- **G4 - Não existe entidade Orçamento/Proposta separada (F2-01).** O "Comercial Execução 1" foi
  feito reusando `SalesOrder` com status DRAFT/SENT/APPROVED/REJECTED/EXPIRED antes de CONFIRMED.
  O backlog (ERP-EXECUTION-AGENTS Execução 3) previa `Quote/Proposal` como entidade própria com
  conversão para `SalesOrder`. Decidir: ratificar o modelo atual (e atualizar os docs) ou
  implementar F2-01 como entidade dedicada.
- **G5 - Payable acumula pelo recebido físico, não pelo aceito.** Teste: recebi 40, aceitei 35,
  rejeitei 5 -> `accruedAmount` = 400 (40/50). Se a regra for "pago só o aceito", deveria ser 350
  (35/50). Definir política.
- **G6 - Estoque pode ficar negativo sem trava.** Consumo/expedição não bloqueiam saldo negativo
  (dado de seed já tem Bolo Chocolate em -191). Definir: bloquear, permitir com aviso, ou permitir
  silenciosamente.
- **G7 - Aprovar o `ApprovalRequest` não avança o pedido.** Aprovar libera o gate, mas o PO/SO
  continua DRAFT e sem notificação ao solicitante. Definir se deve auto-avançar e/ou notificar.
- **G8 - `InventoryLot` sem `@@unique` por (workspace, produto, lotCode, armazém).** Receber o
  mesmo `lotCode` em dois recebimentos cria duas linhas de lote. Definir se `lotCode` é o código
  do fornecedor (deveria consolidar) ou um identificador interno por recebimento.

### Polimento

- **G9 - Deep-link da tela de rastreabilidade não hidrata os filtros.** `?lotCode=X` filtra o
  resultado mas o campo do formulário fica vazio.
- **G10 - i18n inconsistente.** A tela de trace faz tradução inline (`language === 'pt' ? ...`)
  em vez do dicionário `t()` de `src/app/app/i18n.ts`.
- **G11 - Reposição preditiva não é testável com o seed atual.** Os 24 registros de `Consumption`
  são antigos demais para a janela de 30 dias, então `avgDailyConsumption`, `coverageDays` e
  `daysToMinimum` ficam sempre 0/null. Ação: seed de consumo recente.

## Plano de tratamento proposto

1. G3 - alçadas parametrizáveis por workspace (maior impacto, alinhado à diretriz)
2. G9 + G10 + G11 - polimento e seed (rápidos, baixo risco)
3. G4 a G8 - após decisão de negócio/arquitetura
4. Próxima frente ERP: Fase 2 (Comercial) ou Fase 3 (Financeiro)

## Dados de teste criados no dev

Para referência/limpeza. Workspace `WKS0000000001`.

- Pedidos de compra: `cmtdn63990019vroo2vfeo6eq` (5000, CONFIRMED), `cmtdn639x001gvrooxlwyb1m2`
  (500, PARTIALLY_RECEIVED), `cmtdn5kv3000jvroon1r45mmu`, `cmtdn5l43000qvroomantaust`,
  `cmtdn91xv002gvrooe8vscdk1` (rascunho de reposição)
- Pedido de venda: `cmtdn8cms0025vroouiuj63yv` (desconto 30%, CONFIRMED)
- `ApprovalRequest`: 4 (2 APPROVED, 2 PENDING) - `Payable`: 3 - `InventoryLot`: 1 (`LOTE-E2E-001`)
- Config alterada: `Inventory` do Açúcar (`PRD0000000002`) com `minimum=200`, `reorderTarget=400`,
  `criticality=HIGH`, `preferredSupplierId=CLT0000000031`
