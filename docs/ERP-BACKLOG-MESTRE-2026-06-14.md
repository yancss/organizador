# Guardian - Backlog Mestre ERP por Fases

Data: 2026-06-14

## Objetivo

Transformar o estado atual do Guardian em um backlog de execucao continuo, com:
- fases claras
- ordem recomendada
- backlog priorizado
- criterios de pronto
- regras de implementacao

Este arquivo passa a ser a referencia pratica para novas rodadas de execucao ERP.

Documentos relacionados:
- `docs/ERP-GAPS-2026-06-13.md`
- `docs/ERP-EXECUTION-PLAN-2026-06-13.md`
- `docs/ERP-EXECUTION-STATUS-2026-06-13.md`
- `docs/PROJECT.md`

## Estado atual resumido

O Guardian ja possui base operacional relevante:
- cadastros de usuarios, clientes/fornecedores e produtos
- RBAC por workspace
- pedidos de venda
- entregas
- recebiveis, pagamentos e devolucoes
- pedidos de compra
- recebimento parcial de compra
- estoque por produto e por armazem
- transferencias entre armazens
- receitas/producao simples
- financeiro operacional
- aprovacoes
- auditoria

Resumo:
- ja existe nucleo real de ERP operacional
- o gap principal agora e profundidade de processo
- fiscal segue importante, mas nao deve travar as fases abaixo

## Regras permanentes de execucao

Toda fase nova deve respeitar:
- scoping por `workspaceId`
- RBAC e bypass do `support.guardian.app@gmail.com`
- auditoria nos fluxos sensiveis
- i18n minima em `pt`, `es` e `en` quando houver UI nova
- validacao com `npx next build`
- criterio de pronto funcional, nao apenas tecnico

Toda entrega deve fechar um ciclo de negocio identificavel.
Evitar:
- abrir modulo sem fechar processo
- criar tela sem regra operacional clara
- duplicar logica de status, permissao ou movimento

## Ordem recomendada

1. Fase 1 - Estoque rastreavel e suprimentos fortes
2. Fase 2 - Comercial antes e depois do pedido
3. Fase 3 - Financeiro gerencial e conciliacao
4. Fase 4 - Producao com PCP/MRP simples
5. Fase 5 - Importacao em massa, anexos e operacao assistida
6. Fase 6 - Contabil gerencial e fechamento
7. Programa paralelo - Fiscal multinacional

## Andamento atual

### 2026-08-29

- Trabalho ERP acumulado consolidado no commit `57bcc80` (branch `develop`, enviado para `origin`).
- Validação ponta a ponta executada em dev-local. Relatório: `docs/ERP-VALIDACAO-E2E-2026-08-29.md`.
  - Todos os fluxos da Fase 1 + 1a camada de Comercial/Financeiro/Workflow aprovados.
  - Lacunas registradas (G1-G11). G1/G2 (carga de saldo legado) adiadas: viram rotina de
    importação (JSON/planilha) no futuro, não backfill.
  - Fila de tratamento: G3 (alçadas por workspace) -> G9/G10/G11 (polimento) -> G4-G8 (decisão).

### 2026-06-14

- `F1-02` iniciado e entregue na primeira camada:
  - modelo de `InventoryMovement`
  - registro automatico de movimentos nos fluxos atuais
  - historico recente na tela de estoque
  - migration aplicada localmente
- `F1-04` iniciado e entregue na primeira camada:
  - resumo de recebimento por pedido
  - leitura explicita de pendencia, rejeicao e divergencia
  - `dryRun` de recebimento com previsao de estado apos conferencia
  - UI de compras com resumo operacional de divergencias
- `F1-03` iniciado e entregue na primeira camada:
  - motivo obrigatorio para ajuste manual de quantidade
  - observacao opcional do ajuste
  - trilha de ajuste formal aproveitando `InventoryMovement`
  - UI de estoque orientada a ajuste formal
- `F1-03` aprofundado na segunda camada:
  - fluxo de contagem formal separado do simples editar
  - conferencia de quantidade contada com observacao dedicada
  - uso explicito de ajuste por inventario (`COUNT`) no fechamento da contagem
- `F1-06` iniciado e entregue na primeira camada:
  - fila de reposicao com resumo operacional por risco
  - filtros por acao (`acionaveis`, `urgentes`, `em breve`, `monitorar`) e janela pronta
  - consolidacao por fornecedor/janela com leitura de pedido e chegada
  - geracao de rascunho por janela especifica do fornecedor
- `F1-05` iniciado e entregue na primeira camada:
  - reserva calculada por pedido em status operacional (`CONFIRMED`, `IN_PRODUCTION`, `READY`)
  - abatimento automatico do que ja foi expedido
  - leitura de `reservado` e `disponivel` no estoque
  - reposicao passa a considerar saldo disponivel, nao apenas saldo bruto
  - detalhe do pedido mostra o que ja esta reservado e o que ainda falta cobrir
- `F1-01` iniciado e entregue na primeira camada:
  - modelo de lote/validade no estoque (`InventoryLot`)
  - recebimento de compra aceita lote e validade por item
  - saldo por lote passa a ser registrado na entrada de estoque
  - tela de estoque mostra lotes ativos, validade, fornecedor e local
  - serial fica para a proxima camada, junto com consumo/transferencia por lote
- `F1-01` aprofundado na segunda camada:
  - transferencia entre locais preserva lote e validade automaticamente
  - producao consome insumos por FIFO de lote e gera lote de saida
  - expedicao consome FIFO por lote no estoque acabado
  - retorno de entrega recompõe estoque em lote tecnico de retorno quando a origem exata nao existe mais
- `F1-01` aprofundado na terceira camada:
  - lote pode carregar seriais opcionais
  - recebimento aceita lista de seriais por item/lote
  - transferencia interna permite override manual de lote de origem
  - expedicao permite override manual de lote por item antes do `SHIPPED`
  - conflitos de serial/lote viram erro operacional explicito, nao falha generica

Proxima execucao recomendada:
- seguir com baixa por serial individual e rastreabilidade reversa completa por documento

Atualizacao mais recente:
- baixa manual por serial individual entregue na expedicao
- consumo de lote agora aceita subconjunto explicito de seriais quando o operador escolhe o lote
- criada trilha `InventoryLotEvent` para rastrear entrada/saida por lote ligada ao documento de origem
- nova API `/api/inventory/trace` exposta para leitura reversa por produto, lote ou documento
- modal de estoque agora mostra eventos recentes de lote/documento alem do saldo e movimentos globais
- retorno de entrega agora recompõe primeiro os lotes realmente expedidos naquele documento
- lote tecnico de retorno fica apenas como fallback residual quando a trilha original estiver incompleta
- reversao de recebimento de compra agora tenta baixar exatamente os lotes/seriais daquela entrada original
- se o lote recebido ja tiver sido parcialmente consumido por outro fluxo, a reversao falha com erro operacional explicito em vez de distorcer a rastreabilidade

## Fase 1 - Estoque rastreavel e suprimentos fortes

### Objetivo

Fechar o ciclo:
`compra -> recebimento -> estoque -> reposicao -> pagar`

### Escopo

- lote
- validade
- numero de serie quando aplicavel
- ajuste formal de inventario
- motivo de ajuste
- rastreabilidade de entrada e saida
- reserva de estoque
- divergencia de recebimento mais forte
- sugestao de compra com base em minimo, alvo e lead time

### Backlog priorizado

`F1-01` Modelar rastreabilidade de estoque:
- lotes
- validade
- serial opcional
- ligacao com compra, transferencia, ajuste e consumo

`F1-02` Criar movimento de estoque explicito:
- entrada por compra
- saida por consumo
- transferencia
- ajuste
- estorno

`F1-03` Implementar inventario com ajuste formal:
- contagem
- motivo
- aprovacao opcional
- auditoria do antes/depois

`F1-04` Fortalecer recebimento parcial:
- recebido
- aceito
- rejeitado
- divergencia observada
- saldo pendente por item

`F1-05` Reserva de estoque por pedido/processo:
- quantidade reservada
- disponivel
- bloqueada

`F1-06` Sugestao de reposicao:
- minimo
- alvo
- lead time
- multiplo de compra
- fornecedor preferencial

`F1-07` Tela de rastreabilidade:
- origem
- destino
- lote
- quando
- quem movimentou

### Criterio de pronto

- o saldo deixa de ser apenas um numero agregado
- o usuario consegue explicar por que o estoque esta assim
- o usuario consegue receber parcialmente, ajustar e rastrear movimentacao com seguranca

## Fase 2 - Comercial antes e depois do pedido

### Objetivo

Fechar o ciclo:
`orcamento -> pedido -> entrega -> recebivel -> pos-venda`

### Escopo

- orcamento/cotacao separado do pedido
- conversao de orcamento em pedido
- tabela de preco
- condicao de pagamento
- politica comercial
- regras de desconto
- ocorrencias de pos-venda

### Backlog priorizado

`F2-01` Criar entidade de orcamento/proposta

`F2-02` Conversao de orcamento em pedido com trilha de auditoria

`F2-03` Tabela de preco por cliente, periodo ou perfil comercial

`F2-04` Condicoes de pagamento:
- a vista
- parcelado
- vencimentos padrao

`F2-05` Politica comercial:
- limites de desconto
- aprovacao acima da regra

`F2-06` Historico comercial do cliente:
- pedidos
- entregas
- atrasos
- inadimplencia
- devolucoes

`F2-07` Pos-venda basico:
- troca
- devolucao comercial
- ocorrencia

### Criterio de pronto

- o pedido deixa de ser o primeiro objeto comercial
- excecoes comerciais ficam governadas
- o cliente passa a ter historico comercial util para decisao

## Fase 3 - Financeiro gerencial e conciliacao

### Objetivo

Fechar o ciclo:
`operacao financeira -> previsao -> conciliacao -> visao gerencial`

### Escopo

- fluxo de caixa projetado
- conciliacao bancaria
- recorrencia
- provisoes simples
- fechamento por periodo
- DRE gerencial inicial

### Backlog priorizado

`F3-01` Fluxo de caixa projetado:
- entradas previstas
- saidas previstas
- saldo futuro

`F3-02` Recorrencia:
- despesas fixas
- receitas recorrentes
- geracao automatica controlada

`F3-03` Conciliacao bancaria:
- importacao simples
- match manual
- match assistido por regra

`F3-04` Fechamento por periodo:
- competencia
- caixa
- periodo travado

`F3-05` DRE gerencial inicial

`F3-06` Painel de inadimplencia e compromissos

`F3-07` Melhorar vinculos entre compras, vendas e financeiro

### Criterio de pronto

- o gestor consegue prever caixa
- o financeiro deixa de ser apenas historico de lancamentos
- compras e vendas refletem melhor no resultado

## Fase 4 - Producao com PCP/MRP simples

### Objetivo

Fechar o ciclo:
`demanda -> necessidade de material -> ordem de producao -> apontamento -> custo`

### Escopo

- ordem de producao
- status da ordem
- apontamento de execucao
- consumo planejado x real
- producao concluida
- necessidade de material simples

### Backlog priorizado

`F4-01` Criar ordem de producao

`F4-02` Status da producao:
- planejada
- liberada
- em execucao
- concluida
- cancelada

`F4-03` Apontamento de producao:
- quantidade produzida
- perdas
- consumo real
- observacoes

`F4-04` Explosao simples de necessidade de materiais

`F4-05` Relacao entre pedido, producao e disponibilidade

`F4-06` Custo planejado x custo real da producao

`F4-07` Filas operacionais de producao

### Criterio de pronto

- a producao deixa de ser apenas uma execucao simplificada de receita
- o usuario passa a planejar, executar e analisar producao

## Fase 5 - Importacao em massa, anexos e operacao assistida

### Objetivo

Reduzir atrito operacional e permitir escala de uso administrativo.

### Escopo

- importacao CSV/XLSX
- validacao em lote
- anexos por entidade
- processamento em background
- feedback operacional de jobs

### Backlog priorizado

`F5-01` Importacao em massa de clientes

`F5-02` Importacao em massa de produtos

`F5-03` Importacao em massa de pedidos e saldos iniciais

`F5-04` Validacao por linha com relatorio de erro

`F5-05` Anexos para:
- pedidos
- compras
- clientes
- comprovantes
- ajustes

`F5-06` Painel de jobs:
- fila
- progresso
- erro
- download de resultado

`F5-07` Modelos de planilha e onboarding operacional

### Criterio de pronto

- o sistema deixa de depender de cadastro totalmente manual
- o usuario consegue operar migracao e manutencao em escala

## Fase 6 - Contabil gerencial e fechamento

### Objetivo

Elevar o Guardian de financeiro operacional para base de gestao mais proxima de ERP completo.

### Escopo

- plano de contas contabil
- partidas basicas
- centros de resultado mais maduros
- fechamento
- demonstracoes iniciais

### Backlog priorizado

`F6-01` Modelar plano de contas contabil

`F6-02` Regras de classificacao contabil basica

`F6-03` Geracao de partidas a partir do financeiro operacional

`F6-04` Balancete inicial

`F6-05` DRE mais estruturada

`F6-06` Fechamento mensal controlado

`F6-07` Relatorio gerencial por centro de resultado

### Criterio de pronto

- o sistema passa a suportar fechamento gerencial mais serio
- abre caminho para integracao contabil/fiscal posterior

## Programa paralelo - Fiscal multinacional

### Observacao

Fiscal nao sai do radar, mas tambem nao deve bloquear o ERP operacional.

### Direcao

- manter dominio fiscal isolado
- evoluir cadastro por empresa/filial/pais
- evoluir emissao e regras por programa separado
- integrar ao operacional quando os ciclos principais estiverem maduros

## Como executar cada fase

Cada fase deve ser quebrada em:

1. Dominio e dados
2. Regras de negocio
3. APIs
4. UI operacional
5. Auditoria e permissao
6. Relatorios/visao gerencial
7. Teste e validacao funcional

## Template de execucao por item

Usar este formato para abrir e tocar cada item:

### Titulo

`[FASE-CODIGO] Nome curto`

### Objetivo

Qual problema operacional esse item resolve.

### Escopo

- o que entra
- o que nao entra

### Impacto em dominio

- entidades novas
- status novos
- relacionamentos

### Impacto tecnico

- schema Prisma
- APIs
- telas
- jobs
- permissoes
- auditoria

### Criterio de pronto

- comportamento observavel pelo usuario
- criterio de confianca dos dados

## Primeiro backlog recomendado para execucao imediata

Ordem mais saudavel para as proximas rodadas:

1. `F1-02` Movimento de estoque explicito
2. `F1-04` Recebimento parcial com divergencia forte
3. `F1-03` Inventario com ajuste formal
4. `F1-06` Sugestao de reposicao
5. `F2-01` Orcamento/proposta
6. `F3-01` Fluxo de caixa projetado

## Resumo executivo

O Guardian ja tem base suficiente para ser evoluido em ciclos ERP bem definidos.

A estrategia correta agora e:
- parar de abrir frentes soltas
- executar por fases fechando ciclos reais
- fortalecer estoque, comercial, financeiro e producao nessa ordem

Se o time seguir este backlog, o produto sobe de nivel sem perder coerencia arquitetural.
