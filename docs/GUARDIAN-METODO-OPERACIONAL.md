# GUARDIAN-METODO-OPERACIONAL.md

Metodologia operacional recomendada para o projeto **Guardian** usando **Linear** como ferramenta principal de execução.

> Objetivo: manter o projeto leve para um time de 2 pessoas hoje, mas com estrutura suficiente para crescer sem desorganização quando a equipe escalar.

---

## 1) Decisão metodológica

O Guardian deve operar com:

- **Linear** como ferramenta principal de backlog e execução
- **documentação em `docs/`** como fonte de contexto estratégico, técnico e decisório
- **Kanban com cadência quinzenal**, e não Scrum pesado
- **IA integrada ao fluxo de trabalho**, mas sem substituir governança, revisão e critério de pronto

### Por que essa escolha
Para o estágio atual do projeto:
- a equipe é pequena,
- a velocidade de decisão é alta,
- a IA já participa fortemente da execução,
- e excesso de cerimônia atrapalha mais do que ajuda.

Ao mesmo tempo, o projeto precisa nascer com:
- backlog claro,
- rastreabilidade,
- priorização consistente,
- e espaço para crescer.

---

## 2) Princípio central

### Regra de ouro
O Guardian não deve operar com “caos produtivo”.

Mesmo com time pequeno e uso intenso de IA, o trabalho precisa continuar tendo:
- prioridade clara,
- estado visível,
- critério de pronto,
- contexto mínimo,
- e conexão com a estratégia do produto.

---

## 3) Papel do Linear no projeto

O **Linear** deve ser a camada operacional do Guardian.

Ele deve centralizar:
- backlog,
- ciclos,
- status,
- owner,
- bloqueios,
- prioridades,
- dependências,
- e progresso de execução.

### O que fica fora do Linear
O Linear **não substitui** a documentação do projeto.

Os documentos em `docs/` continuam sendo a fonte de verdade para:
- estratégia de produto
- visão de longo prazo
- arquitetura
- regras do projeto
- direções de inovação
- roadmap estruturante

---

## 4) Modelo operacional recomendado

## 4.1) Método-base
Usar **Kanban com cadência quinzenal**.

### Isso significa:
- o fluxo é contínuo
- não há ritual pesado de sprint tradicional
- mas existe uma janela quinzenal para:
  - selecionar foco
  - revisar prioridades
  - redefinir capacidade
  - e medir progresso

### Benefícios
- mantém leveza
- combina bem com time pequeno
- combina bem com desenvolvimento apoiado por IA
- aceita mudanças sem bagunçar o projeto
- preserva visão de curto prazo

---

## 4.2) Cadência recomendada

### Diário / contínuo
- atualizar status real das issues
- registrar bloqueios
- quebrar tarefas grandes quando necessário
- anexar contexto e links relevantes

### Semanal
- revisar progresso do ciclo
- mover prioridades travadas
- limpar backlog confuso
- reavaliar próximos itens

### Quinzenal
- definir foco dos próximos 10 dias úteis
- revisar capacidade
- revisar andamento das frentes estratégicas
- selecionar o que entra no ciclo
- deixar explícito o que não entra

### Mensal
- revisar roadmap
- revisar alinhamento com estratégia
- checar se a execução está servindo ao produto certo
- reavaliar prioridades estruturais

---

## 5) Estrutura recomendada no Linear

## 5.1) Equipes / Projects
Se o Linear permitir estrutura simples, o ideal é ter uma equipe principal do projeto:

- **Guardian**

Dentro dela, usar **Projects** para frentes maiores.

### Projects sugeridos
- Foundation / Multi-tenant
- Auth & RBAC
- Onboarding & Users
- Dashboard & Operations
- Finance & Analytics
- Inventory & Products
- Integrations
- Automation & Rules
- AI / Copilot
- Security & Audit

---

## 5.2) Estados do fluxo

Fluxo recomendado:

1. **Backlog**
2. **Refinement**
3. **Ready**
4. **In Progress**
5. **In Review**
6. **Blocked**
7. **Done**

### Significado de cada estado

#### Backlog
Ideias, demandas, melhorias, bugs e iniciativas ainda não refinadas.

#### Refinement
Item em análise. Já existe intenção, mas ainda falta definição melhor.

#### Ready
Item claro o suficiente para execução.

#### In Progress
Item em execução ativa.

#### In Review
Item pronto tecnicamente, aguardando validação/revisão/teste/check final.

#### Blocked
Item com dependência ou impedimento claro.

#### Done
Item concluído conforme Definition of Done.

---

## 5.3) Tipos de issue

Recomendação de tipos:
- **Feature**
- **Bug**
- **Improvement**
- **Refactor**
- **Infra**
- **Research**
- **Security**
- **Docs**

Isso ajuda a diferenciar trabalho de produto, manutenção, risco técnico e investigação.

---

## 5.4) Labels recomendadas

### Por domínio
- auth
- rbac
- workspace
- users
- admin
- audit
- dashboard
- finance
- inventory
- products
- orders
- purchases
- deliveries
- recipes
- integrations
- automation
- ai
- analytics
- docs
- infra

### Por natureza
- quick-win
- structural
- risk
- blocked
- migration
- ui
- api
- db
- validation-needed

### Por prioridade estratégica
- p0-foundation
- p1-core-value
- p2-operations
- p3-differentiation
- p4-future

---

## 5.5) Campos importantes por issue

Toda issue importante deveria ter, idealmente:
- título claro
- descrição curta do problema/objetivo
- tipo
- domínio/módulo
- prioridade
- impacto
- esforço
- complexidade
- dependências
- critério de pronto
- risco principal
- links para docs
- owner

---

## 6) Como transformar a estratégia em backlog operacional

O fluxo correto é:

### Documentos estratégicos
- `docs/GUARDIAN-PRODUTO-DIRECAO-ESTRATEGICA.md`
- `docs/GUARDIAN-ROADMAP-PRIORIZADO.md`

↓

### Epics / Projects no Linear
Grandes frentes como:
- workspace ativo
- RBAC
- dashboard operacional
- parametrização
- integrações
- copiloto

↓

### Issues quebradas em trabalho executável
Exemplos:
- adicionar `workspaceId` à sessão JWT
- aplicar scoping em `/api/products`
- revisar RBAC de rotas admin
- criar card de pendências críticas no dashboard
- padronizar status de pedidos

### Regra prática
Nenhum item grande deve entrar em `In Progress` sem ser quebrado em algo executável e validável.

---

## 7) Definition of Ready (DoR)

Uma issue está **Ready** quando:
- o objetivo está claro
- o contexto mínimo está descrito
- os arquivos ou áreas afetadas são conhecidas ou inferíveis
- o risco principal é conhecido
- existe critério de pronto
- a prioridade faz sentido no ciclo atual

Se faltar isso, o item deve ficar em **Refinement**.

---

## 8) Definition of Done (DoD)

Uma issue só vai para **Done** quando:
- a mudança foi implementada
- a funcionalidade foi verificada minimamente
- o item respeita `workspaceId` quando aplicável
- o item respeita RBAC/permissões quando aplicável
- não introduz regressão evidente no fluxo tocado
- docs foram atualizadas quando necessário
- riscos residuais foram apontados se existirem

### Regra importante
“Código escrito” **não** significa “feito”.

---

## 9) Como a IA entra no método

A IA faz parte do processo, mas com papel definido.

## 9.1) Onde usar IA

### Refinamento
- quebrar tarefas grandes
- mapear dependências
- sugerir critérios de aceite
- identificar riscos

### Execução
- prototipar implementação
- gerar código inicial
- revisar código existente
- sugerir refactor
- gerar testes

### QA / validação
- sugerir cenários de teste
- apontar edge cases
- revisar impacto possível
- encontrar lacunas na implementação

### Documentação
- atualizar docs
- resumir mudanças
- registrar decisões
- manter notas de progresso

### Gestão
- resumir estado do backlog
- sugerir repriorização
- apontar itens travados
- gerar síntese de ciclo

---

## 9.2) O que a IA não substitui

A IA **não substitui**:
- decisão de prioridade
- validação funcional final
- revisão arquitetural
- responsabilidade por segurança
- definição de escopo do produto

### Regra operacional
IA acelera produção. Ela não elimina a necessidade de critério.

---

## 10) Como a metodologia muda por causa da IA

O uso intenso de IA muda a prática de gestão do projeto.

## 10.1) O gargalo deixa de ser só escrever código
Passa a ser mais:
- decidir bem
- manter consistência
- evitar dívida técnica acelerada
- validar direito
- manter o backlog inteligível

## 10.2) Refinamento fica mais importante
Como construir ficou mais rápido, errar prioridade ou escopo ficou mais caro.

## 10.3) Revisão arquitetural fica mais importante
A IA tende a resolver localmente. O projeto precisa de coerência global.

## 10.4) Backlog melhor > cerimônia maior
No contexto do Guardian, clareza de issue, definição de pronto e ligação com estratégia são mais valiosos do que ritual excessivo.

---

## 11) Como operar com equipe pequena hoje

Hoje a equipe é essencialmente:
- o humano responsável pelo produto/direção
- o agente ajudando com execução, análise, planejamento e documentação

### Isso implica
Não faz sentido criar burocracia de time grande artificialmente.

### Portanto
- manter poucos estados
- manter ciclo leve
- evitar excesso de campos obrigatórios
- documentar só o que gera valor
- quebrar bem as tarefas antes de executar

---

## 12) Como escalar sem recomeçar a metodologia

A metodologia escolhida já deve suportar crescimento.

### O que se mantém quando a equipe crescer
- Projects
- Labels
- estados do fluxo
- Definition of Ready
- Definition of Done
- cadência semanal/quinzenal
- ligação docs ↔ backlog

### O que pode ser adicionado depois
- swimlanes por domínio
- owners múltiplos
- SLOs de revisão
- métricas de throughput / cycle time
- triagem semanal formal
- QA mais estruturado
- critérios de release por ambiente

---

## 13) Automação recomendada no Linear

Quando possível, usar automações simples.

### Exemplos úteis
- ao mover para `In Progress`, registrar owner
- ao marcar bloqueio, exigir motivo curto
- ao concluir issue, pedir checklist mínimo
- ao fechar issue estrutural, exigir link para doc/decision log quando aplicável
- ao criar item grande, sugerir subtarefas

### Automação futura com IA
- sugerir status provável de issues paradas
- resumir progresso do ciclo
- apontar backlog inflado ou mal refinado
- sugerir agrupamento de tarefas por domínio

---

## 14) Estrutura inicial recomendada para o Guardian no Linear

## Ciclos
- ciclos de **2 semanas**

## Visões principais
- All backlog
- Current cycle
- In progress
- Blocked
- By domain
- By priority
- Strategic / structural

## Primeiras épicas recomendadas
1. Workspace ativo + scoping
2. RBAC
3. Auditoria e activity stream
4. Onboarding por convite
5. Dashboard operacional por exceção
6. Padronização de status e fluxos
7. Parametrização por workspace

---

## 15) Política de priorização do backlog

Ao priorizar, usar esta ordem:

1. segurança e isolamento
2. risco estrutural
3. valor operacional diário
4. clareza de processo e domínio
5. observabilidade e visibilidade
6. automação
7. IA / diferenciação avançada

### Regra-chave
Se um item de IA depende de base de dados, processo ou permissão ainda fraca, ele deve esperar.

---

## 16) Reuniões / checkpoints mínimos

Para não criar excesso de processo, usar apenas:

### 1. Check-in semanal
Objetivo:
- revisar progresso
- identificar bloqueios
- ajustar foco

### 2. Planejamento quinzenal
Objetivo:
- decidir o próximo ciclo
- puxar itens do backlog
- deixar claro o que é foco e o que não é

### 3. Revisão mensal de direção
Objetivo:
- conferir alinhamento com o roadmap e com o produto
- evitar entrar em execução desconectada da estratégia

---

## 17) Resumo operacional final

A metodologia do Guardian deve ser:

- **leve o suficiente para um time de 2 pessoas**
- **robusta o suficiente para escalar**
- **centrada em backlog claro e fluxo visual**
- **apoiada por IA, mas não governada por improviso**

### Em uma frase
O Guardian deve operar com **Linear + Kanban com cadência quinzenal + documentação forte + IA como acelerador controlado**.

---

## 18) Próximo passo prático

Depois deste documento, o ideal é criar:

1. a estrutura inicial do workspace no Linear
2. os Projects principais
3. labels e estados
4. os primeiros épicos derivados do roadmap
5. e o backlog inicial do ciclo 1

Se houver conflito entre velocidade e clareza, escolher **clareza suficiente para manter velocidade sustentável**.
