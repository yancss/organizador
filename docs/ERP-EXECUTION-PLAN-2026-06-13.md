# Guardian - Plano de Execucao ERP

Data: 2026-06-13

## Objetivo

Transformar o diagnostico de lacunas ERP em um plano pratico de execucao, com:
- ordem recomendada
- epicos
- entregas por fase
- dependencias
- criterio de pronto
- regras de implementacao alinhadas com a escalabilidade do Guardian

## Premissa central

O Guardian nao precisa virar um ERP gigante de uma vez.

A melhor estrategia e:
1. fechar ciclos operacionais de alto valor
2. manter modularidade
3. preservar governanca
4. implementar tudo com arquitetura preparada para escalar

Fiscal segue como frente estrategica, mas nao entra como bloqueador das proximas fases.

## Sequencia recomendada

Ordem mais saudavel a partir de agora:

1. compras + estoque
2. comercial antes/depois do pedido
3. financeiro gerencial
4. workflow de aprovacao
5. producao em nivel PCP/MRP simples
6. documentos e anexos
7. storage compartilhado + observabilidade operacional das filas
8. fiscal multinacional por programa separado

## Visao por epico

### Epico 1 - Compras e estoque operacional forte

Objetivo:
- fechar o ciclo compra -> recebimento -> estoque -> pagar

Entregas principais:
- recebimento parcial de pedido de compra
- divergencia entre pedido e recebido
- saldo pendente por item do pedido
- estoque minimo
- ponto de reposicao
- sugestao de compra
- reserva de estoque
- inventario com ajuste formal
- transferencia entre locais

Dependencias:
- padronizacao de status de compra
- dominio de movimentacao de estoque mais explicito
- parametrizacao por workspace para politicas de estoque

Criterio de pronto:
- o usuario consegue comprar, receber parcialmente, visualizar pendencias e confiar no saldo
- o sistema passa a indicar risco de ruptura e necessidade de reposicao

Prioridade:
- muito alta

Complexidade:
- alta

Impacto:
- muito alto

### Epico 2 - Comercial completo em torno do pedido

Objetivo:
- fechar o ciclo proposta -> pedido -> entrega -> recebivel

Entregas principais:
- orcamento/proposta
- conversao de orcamento em pedido
- condicao de pagamento
- tabela de precos
- politica comercial
- aprovacao de desconto fora da regra
- devolucao/troca basica
- historico comercial do cliente

Dependencias:
- epico 4 de aprovacao melhora muito esta frente
- regras comerciais parametrizaveis por workspace

Criterio de pronto:
- o pedido deixa de ser o primeiro objeto comercial
- desconto e excecao deixam de ser informais
- o fluxo comercial fica rastreavel do inicio ao fim

Prioridade:
- alta

Complexidade:
- media/alta

Impacto:
- muito alto

### Epico 3 - Financeiro gerencial

Objetivo:
- elevar o financeiro de operacional para ferramenta real de decisao

Entregas principais:
- contas a pagar dedicada e mais forte
- conciliacao bancaria
- fluxo de caixa projetado
- recorrencia
- provisoes simples
- fechamento por periodo
- DRE gerencial inicial

Dependencias:
- melhores vinculos entre compras, vendas e financeiro
- agregados/relatorios mais maduros

Criterio de pronto:
- o gestor consegue entender compromissos, recebimentos, previsao de caixa e resultado operacional sem depender de planilhas externas

Prioridade:
- alta

Complexidade:
- media/alta

Impacto:
- muito alto

### Epico 4 - Workflow de aprovacao

Objetivo:
- aumentar governanca nas operacoes sensiveis

Entregas principais:
- aprovacao de compra por valor/alçada
- aprovacao de desconto
- aprovacao de estorno/baixa/cancelamento
- historico de aprovacao
- politicas por workspace

Dependencias:
- matriz simples de policy
- trilha de auditoria ja fortalecida

Criterio de pronto:
- decisoes sensiveis deixam de depender de combinacao informal
- o produto consegue impor fluxo e deixar rastreabilidade clara

Prioridade:
- media/alta

Complexidade:
- media

Impacto:
- alto

### Epico 5 - Producao em nivel PCP/MRP simples

Objetivo:
- sair de producao como comando tecnico e evoluir para controle operacional

Entregas principais:
- ordem de producao
- apontamento de execucao
- perdas e retrabalho
- WIP basico
- necessidade de materiais
- sugestao de producao/compra a partir da demanda

Dependencias:
- compras/estoque mais maduros
- estrutura de produto/receita consistente

Criterio de pronto:
- o usuario consegue planejar, executar e analisar producao com mais previsibilidade

Prioridade:
- media/alta

Complexidade:
- alta

Impacto:
- alto

### Epico 6 - Documentos e anexos operacionais

Objetivo:
- reduzir dependencia de canais externos e melhorar contexto operacional

Entregas principais:
- anexos em pedidos
- anexos em compras
- anexos em pagamentos e reembolsos
- anexos em clientes e entregas
- metadados de documentos

Dependencias:
- object storage
- politica de permissao e retenção

Criterio de pronto:
- arquivos importantes passam a fazer parte do fluxo do produto

Prioridade:
- media

Complexidade:
- media

Impacto:
- medio/alto

### Epico 7 - Infra funcional para escalar os novos modulos

Objetivo:
- sustentar crescimento das novas frentes sem regredir a base tecnica

Entregas principais:
- storage compartilhado para artefatos/export/anexos
- observabilidade das filas
- backlog e tempo de processamento por job
- metricas de p95/p99 por modulo
- materializacao de relatorios mais pesados

Dependencias:
- filas ja implementadas
- definicao de ambiente alvo

Criterio de pronto:
- o crescimento funcional nao degrada o sistema silenciosamente

Prioridade:
- alta

Complexidade:
- media/alta

Impacto:
- alto

### Epico 8 - Fiscal multinacional

Objetivo:
- evoluir fiscal sem acoplar a plataforma a um unico pais cedo demais

Entregas principais:
- modelo fiscal mais claro por pais/jurisdicao
- adaptadores por pais
- regras tributarias parametrizaveis
- emissao e status por integracao local

Dependencias:
- operacao central madura
- documentos comerciais mais consistentes
- storage e fila consolidados

Criterio de pronto:
- fiscal avanca por trilha separada sem travar os modulos operacionais centrais

Prioridade:
- estrategica, mas nao imediata

Complexidade:
- muito alta

Impacto:
- alto

## Plano pratico por ondas

### Onda 1
- recebimento parcial
- saldo pendente em pedido de compra
- estoque minimo
- sugestao de compra
- reserva de estoque

Resultado esperado:
- maior confianca operacional
- ganho rapido em suprimentos e estoque

### Onda 2
- orcamento/proposta
- conversao em pedido
- condicao de pagamento
- desconto com policy

Resultado esperado:
- comercial deixa de ser informal
- pedido passa a nascer de contexto real

### Onda 3
- contas a pagar forte
- conciliacao bancaria
- fluxo de caixa projetado
- recorrencia

Resultado esperado:
- salto de valor para gestor financeiro

### Onda 4
- aprovacao de compra
- aprovacao de desconto
- aprovacao de baixa/cancelamento

Resultado esperado:
- mais governanca
- menos risco operacional

### Onda 5
- ordem de producao
- apontamento
- perdas
- MRP simples

Resultado esperado:
- producao sobe de nivel sem precisar virar MES complexo

### Onda 6
- anexos
- storage compartilhado
- observabilidade de filas

Resultado esperado:
- base mais madura para continuar crescendo

## Dependencias estruturais transversais

Estas frentes devem acompanhar todas as ondas:

### 1. Status de dominio
- toda entidade critica precisa ter lifecycle claro
- evitar status ambigüos e transicoes soltas

### 2. Parametrizacao por workspace
- politicas de desconto
- alçadas de aprovacao
- limites operacionais
- estoque minimo
- regras de recebimento

### 3. Jobs para trabalho pesado
- calculos de reposicao
- sugestoes
- export
- relatorios
- conciliacao
- planejamento

### 4. Auditoria e historico
- toda decisao relevante precisa ser rastreavel
- aprovacoes precisam gerar trilha estruturada

### 5. Object storage
- anexos e artefatos nao devem depender de disco local no medio prazo

## Criterios de priorizacao daqui para frente

Toda nova funcionalidade deve ser avaliada por:

### Valor de negocio
- fecha um ciclo real de operacao?
- reduz planilha paralela?
- aumenta controle e previsibilidade?

### Valor estrutural
- melhora um dominio central?
- habilita modulos futuros?
- reduz improviso operacional?

### Compatibilidade com escala
- pagina bem?
- pode ser processada em job?
- tem leitura barata no dia a dia?
- respeita multi-tenant e politica por workspace?

## O que eu faria primeiro na pratica

Se a equipe for atacar uma unica frente agora, eu comecaria por:

### Primeira aposta recomendada
- recebimento parcial
- pendencia por item do pedido de compra
- estoque minimo
- sugestao de compra

Por que:
- entrega valor alto
- conversa com compras, estoque e financeiro
- reduz erro operacional cedo
- cria base para producao e planejamento depois

### Segunda aposta recomendada
- orcamento/proposta
- conversao em pedido
- condicao de pagamento

Por que:
- melhora muito a maturidade comercial
- prepara melhor recebivel e faturamento

## Resumo executivo

O Guardian nao precisa abrir todos os modulos tipicos de ERP agora.

Ele precisa fechar melhor os modulos que ja comecou:
- compras
- estoque
- comercial
- financeiro
- producao

A ordem recomendada de execucao e:
1. compras + estoque
2. comercial
3. financeiro gerencial
4. aprovacoes
5. producao
6. anexos e storage
7. fiscal multinacional

Essa ordem preserva:
- foco de produto
- valor real para PME
- menor risco estrutural
- coerencia com a base de escalabilidade que o Guardian ja construiu
