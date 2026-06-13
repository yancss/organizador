# Guardian - Plano Tecnico de Escalabilidade

Data: 2026-06-12

## Objetivo

Registrar:
- diagnostico tecnico de escalabilidade do Guardian
- correcoes ja aplicadas
- ganhos estimados
- parametros de medicao
- proximas ondas de evolucao

## Estado validado

- Aplicacao sobe em dev local com sucesso
- Build de producao passa com `npm run build:ci`
- Stack atual:
  - Next.js 16
  - Prisma
  - PostgreSQL
  - NextAuth JWT

Observacao operacional:
- Em Windows, `prisma generate` pode falhar com `EPERM` se `next dev` estiver usando a DLL do Prisma no mesmo momento. O workaround validado foi parar o processo da porta `3000`, rodar a build e depois subir o dev novamente.

## Diagnostico inicial

Os principais riscos de escala identificados no estado anterior eram:

1. Auth caro por request
- O callback JWT consultava banco com frequencia alta para:
  - usuario
  - membership/workspace ativo
  - permissoes customizadas
- Isso adicionava custo fixo em praticamente toda request autenticada.

2. N+1 em fluxo operacional quente
- A criacao de pedidos resolvia unidade do produto item a item.
- O custo crescia linearmente com a quantidade de itens do pedido.

3. Listagens grandes e pouco enxutas
- Algumas rotas retornavam ate centenas de registros por chamada.
- O frontend fazia parte da busca e paginacao no cliente.
- Isso elevava payload, memoria e latencia percebida.

4. Auditoria sincronizada no caminho quente
- A extensao global do Prisma ainda escreve `AuditEvent` na request principal.
- Isso preserva rastreabilidade, mas aumenta latencia de escrita.

5. Rate limiting nao distribuido
- O middleware usa memoria local por instancia.
- Em ambiente horizontal, a protecao nao e consistente entre replicas.

## Onda 1 - Correcoes aplicadas

### 1. Auth com refresh controlado de contexto

Arquivos:
- `src/lib/auth.ts`
- `src/lib/authz.ts`

Mudancas:
- O token JWT agora carrega:
  - `workspaceId`
  - `workspaceRole`
  - `permissions`
  - `authRefreshedAt`
- O contexto auth deixa de fazer roundtrip completo ao banco em toda request.
- Foi introduzida a janela configuravel `AUTH_CONTEXT_REFRESH_SEC`.
  - default atual: `120` segundos
- `requireWorkspace()` reaproveita permissoes do token quando disponiveis.

Efeito esperado:
- forte reducao do custo fixo de autenticacao/autorizacao por request
- menor pressao em conexoes do banco
- melhor p95 das APIs protegidas

### 2. Remocao de N+1 na criacao de pedidos

Arquivo:
- `src/app/api/orders/route.ts`

Mudancas:
- a validacao de produtos passou a buscar `id` e `unit` em lote
- a normalizacao de unidade deixou de fazer uma query por item

Efeito esperado:
- custo de criacao de pedido deixa de crescer com a mesma intensidade conforme o numero de itens aumenta

## Onda 1 - Ganhos estimados

As estimativas abaixo sao baseadas no custo de queries observado no codigo, nao em benchmark de carga real.

### Auth por request

Antes:
- admin/superadmin: ~2 queries por request autenticada
- usuario comum com role custom: ~3 queries por request autenticada

Depois:
- dentro da janela de refresh: ~0 queries de auth por request
- refresh controlado: 1 refresh por janela configurada

Exemplo com 1 request a cada 5 segundos por 2 minutos:

- Admin
  - antes: 48 queries de auth
  - depois: 2 queries de refresh
  - reducao estimada: ~95,8%

- Usuario comum
  - antes: 72 queries de auth
  - depois: 3 queries de refresh
  - reducao estimada: ~95,8%

### Criacao de pedido com 10 itens

Antes:
- 1 query de validacao em lote
- 1 query de cliente
- 10 queries para resolver unidade dos produtos
- 1 query de create
- total: 13 queries

Depois:
- 1 query de validacao em lote com `unit`
- 1 query de cliente
- 1 query de create
- total: 3 queries

Reducao estimada:
- ~76,9%

## Onda 2 - Correcoes aplicadas

### 1. Paginacao server-driven nas listagens quentes

Rotas atualizadas:
- `GET /api/clients`
- `GET /api/products`
- `GET /api/inventory`
- `GET /api/orders` quando `mode=list`

Padrao introduzido:
- `page`
- `take`
- `q`
- resposta com:
  - array principal
  - `meta.page`
  - `meta.take`
  - `meta.total`
  - `meta.totalPages`

Limites atuais:
- `take` maximo: `100`
- padrao usado nas telas: `25`

### 2. Consumo paginado no frontend

Arquivos atualizados:
- `src/app/app/clients/page.tsx`
- `src/app/app/products/page.tsx`
- `src/app/app/inventory/page.tsx`
- `src/app/app/order-board.tsx`
- `src/app/app/ui/data-table.tsx`

Mudancas:
- busca passou a ser server-driven nas telas principais
- paginacao principal saiu do cliente e foi movida para a API
- `DataTable` ganhou `showFooter={false}` para permitir controle externo
- a lista de pedidos passou a usar paginacao server-driven apenas no modo `list`
- kanban/calendario continuam carregando dataset completo filtrado, para nao quebrar o comportamento operacional atual

### 3. Contencao de churn de busca

Mudancas:
- uso de `useDeferredValue` nas buscas principais do frontend

Efeito esperado:
- menos requests durante digitacao
- UX mais estavel sob latencia moderada

## Onda 2 - Ganhos estimados

### Payload e memoria das listas

Antes:
- paginas de clientes/produtos podiam trazer ate `500` registros por request
- estoque trazia lista completa
- pedidos em lista carregavam dataset inteiro daquele filtro

Depois:
- paginas principais carregam `25` registros por request por padrao
- ordens em modo lista carregam `25` registros por request por padrao

Reducao estimada de payload:
- de `500` para `25` registros nas listas classicas
- reducao de ~95% no numero bruto de registros por resposta

Observacao:
- a reducao real em bytes depende do tamanho medio do objeto e do filtro aplicado

### Custo de render no frontend

Efeito esperado:
- menos objetos em memoria por tela
- menos custo de sort/filter client-side
- melhor responsividade com workspaces grandes

### Custo de banco nas listas

Tradeoff atual:
- cada listagem paginada passa a fazer:
  - 1 query de `count`
  - 1 query de `findMany`

Mesmo com esse tradeoff, o saldo tende a ser positivo porque:
- o payload e muito menor
- a renderizacao e mais leve
- o custo de rede cai
- a UX em workspaces maiores melhora bastante

## Onda 3 - Correcoes aplicadas

### 1. Auditoria "lean" por padrao

Arquivo:
- `src/lib/prisma.ts`

Mudancas:
- a extensao global do Prisma deixou de buscar `before-values` por padrao em `update`
- `updateMany` tambem deixou de fazer leitura previa por padrao
- o audit log continua sendo escrito, mas em modo mais leve
- quando nao houver leitura previa, o evento passa a carregar `meta.diffMode = "minimal"`

Novas flags:
- `AUDIT_BEFORE_VALUES=1`
  - reativa a leitura previa quando for necessario diagnostico mais detalhado
- `PRISMA_DEBUG_LOGS=1`
  - habilita logs de operacao do Prisma
- `AUDIT_DEBUG_LOGS=1`
  - habilita logs verbosos da camada de auditoria

Efeito esperado:
- menos queries extras em writes
- menos ruido de log em ambientes nao focados em debug
- melhor latencia em operacoes de update

### 2. Logs detalhados agora sao opt-in

Antes:
- em dev, havia `console.log` recorrente para praticamente toda operacao interceptada

Depois:
- logs detalhados so aparecem quando habilitados explicitamente por variavel de ambiente

Efeito esperado:
- menos overhead de IO
- menos ruido em troubleshooting normal

### 3. Inicializacao do Prisma endurecida para runtime dev

Foi adicionada uma resolucao defensiva do construtor do `PrismaClient` para lidar melhor com o runtime do `next dev` no Next 16/Turbopack.

Motivacao:
- a build de producao passava
- o modo `dev` chegou a falhar com `PrismaClient is not a constructor`

Resultado validado:
- `npm run build:ci` segue passando
- `npm run dev` voltou a responder `200` em `/` e `/app`

## Onda 3 - Ganhos estimados

### Writes com `update`

Antes:
- `update` auditado podia fazer:
  - 1 leitura previa
  - 1 write principal
  - 1 write de `AuditEvent`

Depois:
- `update` auditado passa a fazer, por padrao:
  - 1 write principal
  - 1 write de `AuditEvent`

Reducao estimada de roundtrips nessas rotas:
- ~33% no numero bruto de operacoes de banco para updates auditados simples

### Writes com `updateMany`

Antes:
- em cenarios elegiveis, `updateMany` ainda podia fazer leitura previa para diff

Depois:
- por padrao, loga em modo minimal sem leitura previa

Reducao esperada:
- menor custo por lote
- menor pressao em rotas com bulk update

### Impacto agregado esperado

Nas rotas de alteracao mais frequentes, esta etapa tende a entregar:
- melhora adicional de ~10% a ~25% na latencia de escrita, dependendo da quantidade de updates auditados por request
- menor variancia no p95 de updates
- menor pressao geral sobre o banco quando houver varios usuarios editando entidades ao mesmo tempo

## Onda 4 - Correcoes aplicadas

### 1. Rate limit distribuido opcional com fallback local

Foi criada uma camada reutilizavel de rate limiting em `src/lib/rate-limit.ts`.

Comportamento:
- se `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` estiverem configurados, o limiter passa a operar em backend distribuido
- se nao estiverem configurados, o sistema continua funcionando com fallback em memoria

Rotas protegidas nesta etapa:
- `/api/auth/*`
- `/api/barcodes/lookup`
- rotas `*/scan`
- `/api/orders/export/*`

Cabecalhos adicionados:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
- `X-RateLimit-Policy`

Impacto esperado:
- comportamento mais previsivel em multiplas instancias quando Upstash estiver ativo
- mais observabilidade operacional no consumo de limites
- melhor protecao para endpoints caros

### 2. Exports com limite defensivo de volume

Os endpoints de exportacao de pedidos agora aplicam limite maximo de linhas por execucao.

Implementacao:
- `EXPORT_MAX_ROWS` controla o teto
- default: `1000`
- hard cap interno: `5000`

Cabecalhos adicionados:
- `X-Export-Row-Limit`
- `X-Export-Truncated`

Impacto esperado:
- evita exports gigantescos derrubando CPU e memoria da instancia
- reduz risco de timeout e payload excessivo
- cria uma transicao segura ate a introducao de exportacao assincrona com fila

### 3. Fila leve de email por outbox

Foi adicionada uma outbox de email baseada em banco:
- model `EmailOutbox` no Prisma
- migration dedicada para criacao da tabela
- processamento por endpoint `POST /api/cron/email-outbox`

Fluxo:
- rotas operacionais agora fazem enqueue de email
- o envio real sai do caminho principal da request
- se a tabela ainda nao existir no banco, o sistema faz fallback para envio sincronizado

Rotas convertidas:
- recuperacao de senha
- convite de usuario
- reset de senha disparado por admin

Configuracoes novas:
- `EMAIL_OUTBOX_FORCE_SYNC=1`
- `EMAIL_OUTBOX_BATCH_SIZE`
- `EMAIL_OUTBOX_MAX_ATTEMPTS`
- `EMAIL_OUTBOX_RETRY_BASE_MS`

Impacto esperado:
- menor latencia percebida em requests que antes dependiam de SMTP/Resend
- menor risco de timeout por provedor externo lento
- base pronta para futuros workers dedicados

### 4. Exportacao assincrona de pedidos

Foi adicionada uma fila de export para pedidos:
- model `ExportJob` no Prisma
- processamento por endpoint `POST /api/cron/export-jobs`
- criacao de job por `POST /api/orders/export-jobs`
- status por `GET /api/orders/export-jobs/[id]`
- download por `GET /api/orders/export-jobs/[id]/download`

Comportamento:
- a UI deixa de depender da geracao CSV/PDF dentro da request principal
- o backend persiste o job e processa o artefato fora do fluxo da tela
- os arquivos gerados ficam em storage local da instancia como passo intermediario

Observacao importante:
- este passo remove CPU do request principal, mas ainda nao e o desenho final para escala horizontal
- o proximo nivel natural e mover os artefatos para object storage compartilhado

Impacto esperado:
- menos timeout em exports
- menos competicao de CPU/memoria com rotas operacionais
- custo por export fica isolado e observavel por job

### 5. Auditoria assincrona com outbox

Foi adicionada uma outbox de auditoria:
- model `AuditOutbox` no Prisma
- migration dedicada
- processamento por endpoint `POST /api/cron/audit-outbox`

Comportamento:
- a extensao do Prisma agora tenta enfileirar o log de auditoria
- se a tabela ainda nao existir, faz fallback para escrita direta em `AuditEvent`
- o processamento converte os jobs em `AuditEvent` + `AuditEventChange`

Configuracoes novas:
- `AUDIT_OUTBOX_FORCE_SYNC=1`
- `AUDIT_OUTBOX_BATCH_SIZE`
- `AUDIT_OUTBOX_MAX_ATTEMPTS`
- `AUDIT_OUTBOX_RETRY_BASE_MS`

Impacto esperado:
- menor custo de escrita no request principal
- menos variacao no p95 das rotas de update/create/delete
- trilha de auditoria preservada sem segurar o fluxo operacional

## Onda 4 - Ganhos estimados

### Rate limit

Com backend distribuido ativo:
- elimina a principal fragilidade do limiter atual em escala horizontal
- reduz brecha de abuso por distribuir a contagem entre instancias

Na pratica:
- a melhoria de throughput nao vem de "ficar mais rapido"
- vem de ficar mais estavel sob pico, brute-force e explosao de retries

### Exports

Antes:
- PDF/CSV podiam crescer sem teto real por request

Depois:
- cada request passa a ter custo maximo controlado por `EXPORT_MAX_ROWS`

Impacto esperado:
- custo de export deixa de crescer indefinidamente com o tamanho do workspace
- menor chance de degradar outras requests concorrentes
- base pronta para uma futura fila de export

### Emails

Antes:
- requests de convite e recuperacao podiam ficar presas no tempo de envio do provedor

Depois:
- a request principal passa a encerrar apos persistir o job de email
- o envio efetivo roda em lote, fora do caminho principal

Impacto esperado:
- reducao relevante do tempo dessas rotas quando houver SMTP/Resend mais lento
- menor variacao de p95 em fluxos administrativos e de autenticacao

### Exports assincronos

Antes:
- CSV/PDF eram montados na mesma request que o usuario disparava

Depois:
- a request principal apenas agenda o job
- a geracao do arquivo roda separadamente e o download acontece quando o job conclui

Impacto esperado:
- queda forte do tempo de resposta percebido ao iniciar export
- menor risco de bloquear workers HTTP com PDF/CSV pesados
- melhor base para instrumentar backlog e tempo por export

### Auditoria assincrona

Antes:
- writes auditadas ainda persistiam `AuditEvent` dentro da request

Depois:
- a request principal passa a enfileirar o log de auditoria
- a materializacao em `AuditEvent` ocorre fora do caminho quente

Impacto esperado:
- melhora adicional de `15%` a `40%` nas writes mais sensiveis, dependendo da rota e do volume de auditoria
- menor contencao sob varios usuarios alterando entidades em paralelo

## Ganho consolidado esperado por fase de crescimento

### Ate dezenas de usuarios ativos e alguns milhares de registros por workspace

As mudancas aplicadas ja devem:
- reduzir bastante o custo fixo de auth
- manter listas operacionais responsivas
- segurar melhor crescimento inicial sem exigir redisenho de infra

### Quando cada workspace comecar a acumular dezenas de milhares de registros

As mudancas atuais ainda ajudam, mas passarao a ser necessarias:
- auditoria assincrona
- revisao de indices baseada em uso real
- possivel migracao de paginacao por offset para cursor nas listas mais profundas
- materializacao de metricas do dashboard

### Quando houver necessidade de escalar horizontalmente

Sera importante adicionar:
- rate limit distribuido
- jobs/filas
- observabilidade de banco e aplicacao

## Parametros recomendados de medicao

Monitorar continuamente:

1. Auth
- queries de auth por request
- refreshes de token por minuto

2. API
- p50, p95 e p99 por rota
- taxa de erro 4xx/5xx
- payload medio por endpoint

3. Banco
- conexoes ativas
- rows scanned vs rows returned
- tempo medio de queries das rotas:
  - `/api/orders`
  - `/api/clients`
  - `/api/products`
  - `/api/inventory`
  - `/api/dashboard`

4. Frontend
- tempo de resposta percebido ao abrir listas
- tempo para primeira renderizacao de tabela
- quantidade de requests disparadas durante digitacao

5. Jobs e protecao
- backlog de fila
- `429` por minuto
- falhas de email/export

## Proximas ondas recomendadas

### Onda 3 - Tirar trabalho do caminho sincronizado

Prioridades:
- mover auditoria para fluxo assincrono ou buffer controlado
- manter trilha de seguranca sem segurar a request operacional
- manter o modo lean atual como default e usar `before-values` apenas quando realmente necessario

Impacto esperado:
- melhora adicional de `15%` a `40%` nas writes mais sensiveis, dependendo da rota

### Onda 4 - Escala operacional distribuida

Prioridades:
- rate limit em Redis/Upstash
- filas para:
  - email
  - exports CSV/PDF
  - tarefas agendadas
  - processamento de auditoria

Impacto esperado:
- mais estabilidade sob pico
- menos timeout em rotas com trabalho pesado

### Onda 5 - Escala analitica e de dados

Prioridades:
- revisao de indices por workload real
- sumarios/materialized views para dashboard
- possivel particionamento de auditoria/eventos
- paginacao por cursor onde offset passar a doer

## Limitacoes conhecidas apos as mudancas

1. O kanban e o calendario de pedidos ainda usam dataset completo filtrado
- isso foi mantido para nao quebrar UX agora
- a lista de pedidos ja esta paginada

2. Auditoria agora depende de processamento da outbox
- a escrita principal ficou mais leve
- mas a consistencia observavel do historico passa a depender do worker/cron processar a fila
- em ambiente sem a migration aplicada, o sistema faz fallback para escrita direta

3. Rate limit continua local por instancia quando Upstash nao estiver configurado
- a camada distribuida esta pronta
- mas o ganho horizontal real depende de `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`

4. Algumas estimativas ainda nao foram validadas em teste de carga
- os ganhos descritos sao tecnicamente fundamentados
- faltam mediciones reais com volume e concorrencia

## Recomendacao pratica

Ordem de investimento mais saudavel a partir deste ponto:

1. finalizar estabilizacao da Onda 2 no uso real
2. instrumentar metricas
3. instrumentar backlog e tempo de processamento das filas
4. adicionar camada distribuida completa para storage compartilhado dos exports
5. revisar indices e dashboard com dados reais de uso

## Resumo executivo

O Guardian saiu de um estado com custo fixo alto por request autenticada e listas carregadas em excesso para um estado melhor preparado para crescimento:

- auth muito mais barata
- criacao de pedido sem N+1 obvio
- listas principais com busca e paginacao server-driven
- frontend mais leve para workspaces maiores

No curto prazo, isso melhora bastante a escalabilidade operacional da plataforma.
No medio prazo, o proximo maior ganho vira de:
- rate limit distribuido
- storage compartilhado para exports
- filas com observabilidade
- observabilidade e ajuste fino de dados
