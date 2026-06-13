# Guardian - Execucoes ERP em Paralelo

Data: 2026-06-13

## Objetivo

Quebrar a evolucao ERP do Guardian em execucoes praticas que possam ser tocadas em paralelo por agentes/equipe, sem perder:
- coerencia de produto
- integridade de dominio
- seguranca
- escalabilidade

## Premissa de trabalho

Nem tudo deve ser feito em paralelo.

A melhor abordagem e:
- paralelizar trilhas com baixo acoplamento
- concentrar alinhamento nos contratos de dominio
- sincronizar em marcos pequenos e frequentes

## Regra de ouro

Antes de qualquer agente implementar, precisam estar fechados:
- status de dominio da entidade
- regras de permissao
- contrato de API
- eventos/auditoria esperados
- parametros por workspace

Sem isso, paralelismo vira retrabalho.

## Estrutura recomendada de agentes

### Agente 1 - Compras e estoque

Missao:
- fechar o ciclo compra -> recebimento -> estoque

Escopo:
- recebimento parcial
- pendencia por item do pedido de compra
- divergencia entre pedido e recebido
- estoque minimo
- ponto de reposicao
- sugestao de compra
- reserva de estoque

Entregas:
- ajuste de schema
- APIs de compra/recebimento
- telas de recebimento
- indicadores de saldo pendente e ruptura

Dependencias:
- alinhamento de status de pedido de compra
- parametrizacao por workspace para estoque minimo

Pode rodar em paralelo com:
- Agente 2
- Agente 4

### Agente 2 - Comercial

Missao:
- fechar o ciclo proposta -> pedido

Escopo:
- orcamento/proposta
- conversao para pedido
- condicao de pagamento
- tabela de precos simples
- politica de desconto

Entregas:
- entidades de proposta
- APIs comerciais
- telas de proposta e conversao
- trilha de desconto

Dependencias:
- contrato de politica comercial
- alinhamento com financeiro para condicao de pagamento

Pode rodar em paralelo com:
- Agente 1
- Agente 4

### Agente 3 - Financeiro gerencial

Missao:
- elevar financeiro para decisao e previsao

Escopo:
- contas a pagar robusto
- fluxo de caixa projetado
- recorrencia
- provisoes simples
- conciliacao bancaria posterior

Entregas:
- dominio de payable mais forte
- vinculo com compras
- dashboards gerenciais
- relatorios de caixa

Dependencias:
- definicao de relacao entre compra e payable
- definicao de agregados/relatorios

Pode rodar em paralelo com:
- Agente 4

Deve sincronizar cedo com:
- Agente 1
- Agente 2

### Agente 4 - Governance Layer

Missao:
- garantir que os novos modulos nascam com controle e consistencia

Escopo:
- workflow de aprovacao
- policy por workspace
- matriz de alçadas
- padronizacao de status e transicoes
- auditoria e eventos de negocio

Entregas:
- contrato de workflow transversal
- tabelas/config de policy
- helpers reutilizaveis para approval flow
- padrao de auditoria por modulo

Dependencias:
- nenhuma funcional forte

Pode rodar em paralelo com:
- todos os demais

Observacao:
- este agente nao deve ficar "esperando funcional"
- ele prepara os contratos para os outros

### Agente 5 - Producao e planejamento

Missao:
- evoluir producao simples para controle operacional

Escopo:
- ordem de producao
- apontamento
- perdas e retrabalho
- WIP
- necessidade de materiais

Entregas:
- ordem de producao
- APIs de apontamento
- tela de execucao
- base para MRP simples

Dependencias:
- Agente 1 precisa ter amadurecido estoque e reposicao

Pode rodar em paralelo com:
- Agente 6

### Agente 6 - Documentos, anexos e storage

Missao:
- colocar documentos no fluxo certo do produto

Escopo:
- anexos em pedidos
- anexos em compras
- anexos em financeiro
- metadados e permissoes
- storage compartilhado

Entregas:
- camada de upload
- metadados no banco
- integraçao com object storage
- visualizacao/download controlado

Dependencias:
- definicao de provider de storage

Pode rodar em paralelo com:
- Agente 5

## Ordem de execucao por fases

### Fase 1 - Contratos e base comum

Responsavel principal:
- Agente 4

Objetivo:
- fechar contratos antes do paralelismo pesado

Itens:
- matriz de status
- regra de transicao
- politica de aprovacao
- estrategia de parametrizacao por workspace
- eventos/auditoria esperados por modulo

Resultado:
- base comum para os outros agentes implementarem sem colisao conceitual

### Fase 2 - Duas frentes principais em paralelo

Frentes:
- Agente 1
- Agente 2

Objetivo:
- atacar os dois loops de maior impacto operacional

Bloco A:
- compras/estoque

Bloco B:
- comercial/proposta/pedido

Sincronizacao obrigatoria:
- condicao de pagamento
- reserva de estoque
- politica de desconto

### Fase 3 - Financeiro entra forte

Frente:
- Agente 3

Objetivo:
- conectar compra e venda ao financeiro gerencial

Itens:
- payable forte
- caixa projetado
- recorrencia
- agregados iniciais

Sincronizacao obrigatoria:
- com Agente 1 para compra/pagar
- com Agente 2 para pedido/receber

### Fase 4 - Workflow e approvals em profundidade

Frente:
- Agente 4

Objetivo:
- consolidar alçadas e aprovacoes nos modulos ja construidos

Itens:
- compra acima do limite
- desconto fora da policy
- baixa/cancelamento manual

### Fase 5 - Producao e planning

Frente:
- Agente 5

Objetivo:
- usar a maturidade de estoque/compras para subir producao de nivel

### Fase 6 - Documentos e storage compartilhado

Frente:
- Agente 6

Objetivo:
- completar o contexto operacional e remover dependencia de storage local onde ainda houver

## Backlog inicial por execucao

### Execucao 1
- definir status oficiais de `PurchaseOrder`
- definir estados de recebimento parcial
- definir como representar saldo pendente por item

Responsavel:
- Agente 4 + Agente 1

### Execucao 2
- modelar estoque minimo e ponto de reposicao por produto/workspace
- criar consulta de ruptura e sugestao de compra

Responsavel:
- Agente 1

### Execucao 3
- modelar `Quote/Proposal`
- definir conversao para `SalesOrder`
- definir trilha de aprovacao de desconto

Responsavel:
- Agente 2 + Agente 4

### Execucao 4
- fortalecer `payables`
- vincular compra e previsao de saida de caixa

Responsavel:
- Agente 3 + Agente 1

### Execucao 5
- definir policy engine simples por workspace
- alçadas
- thresholds
- overrides auditaveis

Responsavel:
- Agente 4

### Execucao 6
- ordem de producao
- apontamento
- perdas

Responsavel:
- Agente 5

### Execucao 7
- anexos e storage compartilhado
- substituicao progressiva de artefatos locais

Responsavel:
- Agente 6

## Regras de sincronizacao

### Reuniao de contrato antes do codigo

Cada frente precisa fechar antes:
- nomes de entidades
- nomes de status
- eventos relevantes
- contratos de API

### Merge pequeno e frequente

Evitar:
- branches enormes
- varios modulos sendo fechados de uma vez

Preferir:
- slices pequenos
- contracts first
- feature flags quando necessario

### Dono do contrato

Para evitar conflito:
- Agente 4 e dono dos contratos transversais
- cada agente funcional e dono do seu dominio

## O que pode ser feito simultaneamente de verdade

Paralelo seguro:
- Agente 1 e Agente 2
- Agente 4 junto com todos
- Agente 6 preparando storage e anexos enquanto outras frentes evoluem

Paralelo com cuidado:
- Agente 3 com Agente 1 e 2

Paralelo nao recomendado cedo demais:
- Agente 5 antes de compras/estoque amadurecerem
- fiscal profundo junto de tudo

## Risco principal do paralelismo

O maior risco nao e tecnico.
E semantico.

Se cada frente inventar:
- seu proprio status
- sua propria regra de aprovacao
- seu proprio conceito de fechamento

o sistema cresce quebrado.

Por isso, o ganho real de paralelismo no Guardian depende de:
- contratos de dominio primeiro
- incrementos curtos
- sincronizacao frequente

## Resumo executivo

Sim, o trabalho pode ser distribuido em paralelo.

A melhor distribuicao hoje seria:
- Agente 1: compras/estoque
- Agente 2: comercial
- Agente 3: financeiro
- Agente 4: governance/workflow/policies
- Agente 5: producao
- Agente 6: anexos/storage

Mas a execucao correta nao e "todo mundo codando qualquer coisa ao mesmo tempo".

A forma mais eficiente e:
1. fechar contratos comuns
2. rodar compras/estoque e comercial em paralelo
3. conectar financeiro
4. consolidar approvals
5. subir producao
6. fechar anexos/storage

Esse desenho preserva escalabilidade, reduz retrabalho e aumenta a chance de cada entrega realmente encaixar no Guardian.
