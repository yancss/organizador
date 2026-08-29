# ERP Execution Status - 2026-06-13

## Concluido

### Agente 1 - Compras e estoque

- Execucao 1: recebimento parcial de pedido de compra
  - Novo status de dominio: `PARTIALLY_RECEIVED`
  - Novo acumulador por item: `PurchaseOrderItem.receivedQty`
  - API de recebimento aceita recebimento parcial por item
  - UI mostra pendencia por pedido e permite receber quantidades parciais
  - Regras de seguranca:
    - pedido cancelado nao pode ser recebido
    - item nao pode receber acima do pendente
    - itens ficam imutaveis depois do inicio do recebimento
    - status nao pode retroceder para estados pre-recebimento

- Execucao 2: divergencia de recebimento por item
  - Novos acumuladores por item: `acceptedQty` e `rejectedQty`
  - Nova observacao operacional por item: `receiptObservation`
  - Recebimento agora separa:
    - quantidade fisica recebida
    - quantidade aceita em estoque
    - quantidade rejeitada
  - Regras operacionais:
    - estoque entra apenas pela quantidade aceita
    - excesso pode ser registrado no recebido sem inflar a quantidade aceita
    - avaria/excesso pode ser registrado como rejeicao com observacao
    - pendencia continua baseada no recebido fisico contra o pedido
  - UI de recebimento agora permite conferir e registrar divergencia por item antes de confirmar

- Execucao 3: transferencia entre estoques/localizacoes
  - Novo dominio de localizacao: `Warehouse`
  - Novo saldo por local: `InventoryByWarehouse`
  - Novo registro de transferencia: `InventoryTransfer`
  - Regras operacionais:
    - estoque global continua existindo como saldo consolidado por produto
    - toda movimentacao global nova sincroniza automaticamente o deposito padrao
    - transferencia move saldo entre locais sem alterar o total global
    - origem e destino precisam pertencer ao mesmo workspace
    - origem nao pode transferir acima do saldo local
  - Entregas desta etapa:
    - `GET|POST /api/warehouses`
    - `GET /api/inventory/[productId]/locations`
    - `GET|POST /api/inventory/transfers`
    - tela de estoque permite criar local rapidamente e transferir saldo por produto

- Execucao 4: estoque minimo e sugestao de reposicao
  - Novo parametro por item de estoque: `reorderTarget`
  - `minimum` continua sendo o ponto de ruptura
  - `reorderTarget` define o alvo sugerido para recompra/reposicao
  - Regras operacionais:
    - item entra na consulta de reposicao quando `quantity < minimum`
    - sugestao calculada = `reorderTarget - quantity`
    - se `reorderTarget` nao estiver definido, a sugestao usa o proprio `minimum` como alvo
  - Entregas desta etapa:
    - `GET /api/inventory?mode=replenishment` com paginacao
    - tela de estoque com toggle para ver apenas reposicao
    - modal de estoque permite editar `minimum` e `reorderTarget`

- Execucao 5: sugestao operacional de compra
  - Novo vinculo por item de estoque: `preferredSupplierId`
  - Regras operacionais:
    - reposicao pode ser consolidada por fornecedor preferencial
    - apenas itens `RAW` abaixo do minimo entram na sugestao de compra
    - geracao de rascunho usa `suggestedQty` calculado na reposicao
    - custo estimado do rascunho usa `avgCost` atual quando disponivel
  - Entregas desta etapa:
    - `GET /api/purchase-orders/replenishment`
    - `POST /api/purchase-orders/replenishment/draft`
    - modal de estoque permite definir fornecedor preferencial
    - visao de reposicao permite gerar rascunho de pedido por fornecedor

- Execucao 6: politicas de compra por fornecedor
  - Novos parametros por item de estoque:
    - `supplierLeadTimeDays`
    - `supplierMinOrderQty`
    - `supplierOrderMultiple`
  - Regras operacionais:
    - a ruptura continua sendo calculada por `minimum` e `reorderTarget`
    - a sugestao final de compra passa a respeitar lote minimo e multiplo
    - o draft de compra gerado pela reposicao usa a quantidade ajustada pela policy
  - Entregas desta etapa:
    - modal de estoque permite configurar lead time, lote minimo e multiplo
    - `GET /api/inventory?mode=replenishment` expõe sugestao ja ajustada
    - `GET /api/purchase-orders/replenishment` consolida custo/quantidade com policy aplicada
    - `POST /api/purchase-orders/replenishment/draft` gera rascunho com quantidade ajustada

- Execucao 7: compra assistida e previsao
  - Consumo recente passa a alimentar a prioridade de reposicao
  - Regra operacional:
    - consumo medio diario usa janela recente de `30` dias a partir de `Consumption`
    - projeção no lead time = saldo atual menos consumo projetado ate a chegada
    - prioridade sobe para urgente quando a projeção atravessa o minimo dentro do lead time
  - Entregas desta etapa:
    - `GET /api/purchase-orders/replenishment` agora retorna risco preditivo e projecao
    - visao de reposicao usa a API preditiva como fonte principal
    - rascunho de compra passa a antecipar ruptura futura, nao apenas ruptura atual

- Execucao 8: reposicao multi-criterio
  - Urgencia operacional e conveniencia financeira deixam de ser a mesma coisa
  - Regras operacionais:
    - prioridade operacional usa risco preditivo de ruptura
    - custo continua visivel como eixo financeiro separado
    - ausencia de fornecedor continua aparecendo na consolidacao por grupo como gargalo operacional
  - Entregas desta etapa:
    - `GET /api/purchase-orders/replenishment` agora ordena a lista por risco preditivo
    - grupos de fornecedor passam a carregar contagem de itens urgentes
    - visao de reposicao do estoque passa a consumir a lista preditiva como fonte principal

- Execucao 9: criticidade explicita do item
  - Novo parametro por item de estoque: `criticality`
  - Regras operacionais:
    - cada insumo pode ser marcado como `LOW`, `MEDIUM` ou `HIGH`
    - a criticidade passa a desempatar prioridade entre itens com risco preditivo parecido
    - a configuracao fica disponivel tanto na manutencao do estoque quanto na visao operacional de reposicao
  - Entregas desta etapa:
    - `Inventory` passa a persistir criticidade explicita
    - `GET /api/inventory` e `PATCH /api/inventory/[productId]` passam a expor/salvar criticidade
    - `GET /api/purchase-orders/replenishment` usa criticidade como segundo criterio de ordenacao
    - tela de estoque mostra badge de criticidade e permite editar o nivel no modal

- Execucao 10: cobertura por dias e janela de compra
  - A reposicao passa a ficar legivel em dias operacionais, nao so em saldo absoluto
  - Regras operacionais:
    - cobertura em dias = saldo atual dividido pelo consumo medio diario recente
    - janela de compra = lead time do fornecedor + buffer operacional curto
    - item pode entrar em sugestao de compra antes de romper o minimo, se ja estiver dentro da janela
  - Entregas desta etapa:
    - `src/lib/replenishment.ts` passa a calcular `coverageDays`, `purchaseWindowDays` e `isInPurchaseWindow`
    - `GET /api/purchase-orders/replenishment` passa a expor cobertura e janela na resposta
    - visao de reposicao mostra cobertura, janela e previsao ate o minimo por item
    - rascunho de compra herda a sugestao antecipada quando o item ja entrou em janela operacional

- Execucao 11: reposicao por calendario do fornecedor
  - O calendario comercial do fornecedor passa a alterar a espera real ate a reposicao
  - Regras operacionais:
    - fornecedor pode ter dias fixos de pedido (`supplierOrderDays`)
    - fornecedor pode ter dias usuais de entrega (`supplierDeliveryDays`)
    - o lead time efetivo passa a considerar:
      - espera ate a proxima janela de pedido
      - lead time base ja configurado no item
      - deslocamento ate o proximo dia de entrega disponivel
  - Entregas desta etapa:
    - `Client` passa a persistir calendario comercial de fornecedor
    - cadastro de clientes/fornecedores permite marcar dias de pedido e entrega
    - `GET /api/purchase-orders/replenishment` passa a calcular `effectiveLeadTimeDays` e `nextOrderInDays`
    - a reposicao antecipa prioridade quando a proxima janela comercial estiver distante
    - `POST /api/purchase-orders/replenishment/draft` herda o mesmo calendario para manter coerencia com a sugestao

- Execucao 12: corte horario e excecoes de calendario
  - O calendario comercial passa a ter granularidade suficiente para o dia a dia real
  - Regras operacionais:
    - fornecedor pode ter hora limite para ainda fechar pedido no mesmo dia (`supplierOrderCutoffHour`)
    - fornecedor pode ter datas bloqueadas sem alterar o cadastro base da semana (`supplierBlockedDates`)
    - proximo pedido e chegada estimada pulam automaticamente essas excecoes
  - Entregas desta etapa:
    - `Client` passa a persistir hora limite e datas bloqueadas
    - cadastro de fornecedor permite editar cutoff e lista de datas bloqueadas
    - calculo de calendario em `src/lib/replenishment.ts` passa a respeitar cutoff + excecoes

- Execucao 13: data sugerida de pedido e chegada
  - A reposicao deixa de mostrar apenas distancia em dias e passa a mostrar datas operacionais concretas
  - Regras operacionais:
    - resposta de reposicao expÃµe `nextOrderDate` e `expectedArrivalDate`
    - lead time efetivo passa a ser lido como caminho inteiro ate a chegada, nao apenas numero abstrato
  - Entregas desta etapa:
    - `GET /api/purchase-orders/replenishment` passa a devolver datas de pedido e chegada
    - visao de reposicao mostra pedido em X dias, data sugerida de pedido e chegada estimada

- Execucao 14: contexto operacional no rascunho de compra
  - O pedido gerado por reposicao passa a nascer com rastro do planejamento que o originou
  - Regras operacionais:
    - observacao do draft passa a registrar proxima data sugerida de pedido
    - observacao do draft passa a registrar chegada estimada consolidada
  - Entregas desta etapa:
    - `POST /api/purchase-orders/replenishment/draft` agora incorpora contexto operacional automaticamente
    - sugestao, tela e draft passam a compartilhar a mesma leitura de calendario do fornecedor

- Execucao 15: agrupamento economico por janela de compra
  - A consolidacao deixa de olhar apenas fornecedor e passa a respeitar a janela comercial concreta
  - Regras operacionais:
    - agrupamento de reposicao passa a usar `fornecedor + nextOrderDate`
    - urgencia operacional continua visivel por `urgentCount`
    - itens nao urgentes dentro da mesma janela passam a formar bloco de consolidacao economica
  - Entregas desta etapa:
    - `GET /api/purchase-orders/replenishment` agora consolida grupos por janela de compra
    - grupos passam a expor `nextOrderDate`, `expectedArrivalDate`, `nextOrderInDays` e `consolidationCount`
    - ordenacao prioriza urgencia e, em seguida, a proxima janela comercial

- Execucao 16: lote economico sugerido por janela
  - A reposicao passa a sugerir aumento opcional de compra sem confundir isso com ruptura operacional
  - Regras operacionais:
    - sugestao economica so aparece quando existe janela de compra compartilhada com item urgente do mesmo fornecedor
    - quantidade economica fica separada da `suggestedQty` operacional
    - consolidacao economica nao altera o risco operacional do item
  - Entregas desta etapa:
    - `GET /api/purchase-orders/replenishment` agora expÃµe `economicSuggestedQty`
    - grupos passam a acumular `totalEconomicQty`, `economicItemCount` e `economicEstimatedCost`
    - tela de reposicao mostra extra economico opcional por item

- Execucao 17: politica de consolidacao por valor minimo de pedido
  - A consolidacao economica passa a enxergar piso financeiro do fornecedor
  - Regras operacionais:
    - fornecedor pode ter `supplierMinOrderValue`
    - a janela de compra passa a calcular quanto falta para atingir o piso financeiro
    - esse complemento continua separado da urgencia operacional e nao infla a sugestao minima
  - Entregas desta etapa:
    - `Client` passa a persistir valor minimo de pedido
    - cadastro de fornecedor permite editar o piso financeiro
    - `GET /api/purchase-orders/replenishment` agora expÃµe `minimumOrderValue` e `missingToMinimumOrderValue` por grupo

## Validacao

- Migration aplicada localmente: `20260613012000_purchase_order_partial_receive`
- Migration criada para divergencia: `20260613024500_purchase_order_receipt_divergence`
- Migration criada para localizacoes e transferencias: `20260613034000_inventory_warehouses_and_transfers`
- Migration criada para alvo de reposicao: `20260613043000_inventory_reorder_target`
- Migration criada para fornecedor preferencial: `20260613051500_inventory_preferred_supplier`
- Migration criada para politica de compra por fornecedor: `20260613054500_inventory_supplier_purchase_policy`
- Migration criada para criticidade do item: `20260613181500_inventory_criticality`
- Migration criada para calendario comercial do fornecedor: `20260613191500_supplier_calendar_windows`
- Migration criada para cutoff e excecoes de calendario: `20260613195500_supplier_calendar_cutoff_and_exceptions`
- Migration criada para valor minimo do pedido por fornecedor: `20260613230500_supplier_min_order_value`
- Migrations aplicadas localmente com `prisma migrate deploy`
- `npm run build:ci`: aprovado
- `npm run test:run -- src/app/app/inventory/inventory.page.test.tsx`: aprovado
- `npm run test:run -- src/app/app/inventory/inventory.page.test.tsx src/app/app/purchases/orders/purchase-orders.page.test.tsx`: aprovado
- Projeto validado em `dev` respondendo `200` em `http://localhost:3000`

## Ganho esperado

- Pedido de compra deixa de depender de recebimento total para atualizar estoque
- Operacao de compras passa a refletir entregas fracionadas sem gambiarra de duplicar pedido
- Menor risco de divergencia entre estoque fisico e pedido administrativo ao longo do uso
- Menor risco de inflar estoque quando houver avaria ou excesso no recebimento
- Base pronta para proxima camada de conferencia financeira/fornecedor em cima das divergencias registradas
- Base pronta para evoluir para deposito principal + locais satelite sem reescrever o estoque inteiro
- Base pronta para gerar lista operacional de compra/reposicao sem precisar scannear manualmente o estoque inteiro
- Base pronta para transformar ruptura em pedido de compra rascunho com menos trabalho manual
- Base pronta para evoluir de reposicao simples para compra guiada por politica real de fornecedor
- Base pronta para evoluir de compra reativa para compra priorizada por previsao operacional
- Base pronta para separar ranking operacional de ruptura do olhar financeiro de custo
- Base pronta para refletir impacto operacional real de cada item na fila de reposicao
- Base pronta para orientar compra por cobertura e tempo restante, nao apenas por saldo nominal
- Base pronta para considerar agenda comercial real do fornecedor na decisao de compra
- Base pronta para transformar sugestao operacional em decisao auditavel com data concreta de pedido e chegada
- Base pronta para separar compra urgente de consolidacao economica dentro da mesma agenda comercial
- Base pronta para sugerir ganho economico opcional sem poluir a leitura do minimo operacional
- Base pronta para considerar piso financeiro real do fornecedor antes de fechar a janela de compra

## Proximas execucoes paralelizaveis

### Agente 1 - Compras e estoque

- Trilha atual concluida no doc
  - compras/estoque ficou sem execucoes adicionais explicitamente previstas neste arquivo
  - proxima rodada deve nascer da validacao de processo ou de um novo backlog

### Agente 2 - Comercial

- Execucao 1: orcamento antes do pedido
  - status `DRAFT`, `SENT`, `APPROVED`, `REJECTED`, `EXPIRED`
  - conversao controlada para pedido

### Agente 3 - Financeiro

- Execucao 1: contas a pagar dedicadas
  - separar compromisso operacional de titulo financeiro
  - manter ligacao com pedido de compra e recebimento

### Agente 4 - Workflow

- Execucao 1: motor simples de aprovacao por alçada
  - compras por valor
  - descontos fora de politica

## Regra de continuidade

- Toda execucao nova deve manter:
  - scoping por `workspaceId`
  - listas paginadas
  - jobs assincronos para trabalho pesado
  - trilha auditavel
  - estados de dominio explicitos

## Fechamento complementar da rodada

- Comercial Execucao 1 concluida
  - `SalesOrderStatus` passou a cobrir `DRAFT`, `SENT`, `APPROVED`, `REJECTED`, `EXPIRED` antes do pedido confirmado
  - a conversao ficou controlada por transicao explicita `APPROVED -> CONFIRMED`
  - desconto fora de politica ja abre solicitacao de aprovacao
- Financeiro Execucao 1 concluida
  - novo dominio `Payable` separado de `FinancialEntry`
  - ligacao direta com `PurchaseOrder`, fornecedor e recebimento parcial/total
  - tela `finance/payables` migrou para `/api/payables`
- Workflow Execucao 1 concluida
  - novo dominio `ApprovalRequest`
  - compras acima da alcada padrao e descontos fora de politica exigem aprovacao
  - fila simples disponivel em `app/workflow/approvals`
- Migration aplicada nesta etapa: `20260613221351_sales_quotes_payables_approvals`
- Validacao final:
  - `npx prisma migrate deploy`: aprovado
  - `npm run build:ci`: aprovado
  - `npm run test:run -- src/app/app/sales/orders/sales-orders.page.test.tsx src/app/app/purchases/orders/purchase-orders.page.test.tsx src/app/app/clients/clients.page.test.tsx src/app/app/finance/finance.page.test.tsx`: aprovado
  - `http://localhost:3000`: respondeu `200`
