# GUARDIAN-LINEAR-SETUP-INICIAL.md

Setup inicial recomendado do **Linear** para o projeto **Guardian**.

> Objetivo: permitir configurar o Linear rapidamente com uma estrutura boa o suficiente para começar já, sem travar a evolução futura do projeto.

---

## 1) Estrutura principal

## Team
Criar uma team principal:
- **Guardian**

Se no futuro surgir separação de squads/domínios, isso pode evoluir. Agora, uma team só é suficiente.

---

## 2) Workflow / Status

Configurar os estados abaixo:

1. **Backlog**
2. **Refinement**
3. **Ready**
4. **In Progress**
5. **In Review**
6. **Blocked**
7. **Done**

### Ordem sugerida no board
Backlog → Refinement → Ready → In Progress → In Review → Blocked → Done

### Observação
Se o Linear exigir outra ordem operacional, manter semanticamente os mesmos estados.

---

## 3) Cycles

Configurar:
- **ciclos de 2 semanas**

### Política recomendada
- usar os ciclos para foco, não para engessamento
- não lotar ciclos demais
- deixar folga para bugs, ajustes e imprevistos

---

## 4) Projects sugeridos

Criar inicialmente estes Projects:

1. **Foundation / Multi-tenant**
2. **Auth & RBAC**
3. **Security & Audit**
4. **Onboarding & Users**
5. **Dashboard & Operations**
6. **Domain Standardization**
7. **Workspace Settings & Parametrization**
8. **Analytics & Reporting**
9. **Integrations**
10. **Automation & Rules**
11. **AI / Copilot**

### Observação prática
Se quiser começar mais enxuto, os 7 primeiros já bastam.

---

## 5) Issue types

Se o plano do Linear permitir customização clara de tipos, usar:
- **Feature**
- **Bug**
- **Improvement**
- **Refactor**
- **Infra**
- **Research**
- **Security**
- **Docs**

Se não permitir esse nível, simular com labels.

---

## 6) Labels recomendadas

## 6.1) Labels por domínio
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

## 6.2) Labels por natureza
- quick-win
- structural
- risk
- migration
- ui
- api
- db
- validation-needed
- blocked-external
- blocked-internal

## 6.3) Labels por prioridade estratégica
- p0-foundation
- p1-core-value
- p2-operations
- p3-differentiation
- p4-future

---

## 7) Views recomendadas

Criar estas views:

### 7.1) Board principal
- **Execution Board**
- agrupado por status
- filtro: team Guardian

### 7.2) Backlog geral
- **All Backlog**
- filtro: status Backlog + Refinement + Ready

### 7.3) Ciclo atual
- **Current Cycle**
- filtro: cycle atual

### 7.4) Em progresso
- **In Progress**
- filtro: In Progress + In Review + Blocked

### 7.5) Bloqueados
- **Blocked**
- filtro: status Blocked

### 7.6) Por domínio
- **By Domain**
- agrupado por labels principais

### 7.7) Estruturais / estratégicos
- **Structural**
- filtro: labels `structural`, `p0-foundation`, `p1-core-value`

### 7.8) Segurança e governança
- **Security & Governance**
- filtro: labels `security`, `auth`, `rbac`, `workspace`, `audit`

---

## 8) Campos mínimos que cada issue deve ter

Cada issue relevante deve conter:

- título claro
- descrição curta
- contexto
- impacto esperado
- critério de pronto
- labels adequadas
- project
- priority
- owner (quando entrar em execução)

---

## 9) Template recomendado para issue

Usar este formato de descrição:

```md
## Contexto

## Problema / Objetivo

## Escopo

## Critério de pronto
- [ ]
- [ ]
- [ ]

## Riscos / Observações

## Links
- docs/... 
```

---

## 10) Primeiros épicos recomendados

Criar como épicos/projetos estruturantes:

### Epic 1 — Workspace ativo + scoping completo
Objetivo:
- consolidar multi-tenant real por `workspaceId`

### Epic 2 — RBAC consistente
Objetivo:
- garantir autorização coerente entre UI, API e papéis

### Epic 3 — Auditoria e activity stream
Objetivo:
- tornar rastreabilidade e histórico úteis para suporte, segurança e operação

### Epic 4 — Onboarding por convite
Objetivo:
- fechar o fluxo de criação, convite e ativação de usuários

### Epic 5 — Dashboard operacional por exceção
Objetivo:
- transformar a home em centro de atenção operacional

### Epic 6 — Padronização de status e fluxos
Objetivo:
- padronizar domínio, status e transições

### Epic 7 — Parametrização por workspace
Objetivo:
- preparar o produto para escala com configuração controlada por cliente

---

## 11) Backlog inicial recomendado para o ciclo 1

### Bloco A — Fundação crítica
1. **Adicionar `workspaceId` e `workspaceRole` à sessão**
   - labels: workspace, auth, p0-foundation, structural

2. **Mapear endpoints que ainda não aplicam scoping corretamente**
   - labels: workspace, api, audit, p0-foundation, research

3. **Aplicar scoping consistente nos endpoints de maior risco**
   - labels: workspace, api, security, p0-foundation, structural

4. **Revisar rotas/admin e ações sensíveis sob ótica de RBAC**
   - labels: rbac, admin, security, p0-foundation

5. **Definir matriz inicial de papéis e permissões**
   - labels: rbac, docs, p0-foundation

### Bloco B — Valor operacional rápido
6. **Mapear eventos críticos para trilha de auditoria**
   - labels: audit, structural, p1-core-value

7. **Criar modelo inicial de activity stream**
   - labels: audit, dashboard, p1-core-value

8. **Especificar cards do dashboard operacional por exceção**
   - labels: dashboard, analytics, p1-core-value, research

9. **Padronizar status principais de um domínio prioritário**
   - labels: structural, products/orders/finance, p1-core-value

10. **Fechar desenho do fluxo de convite e ativação**
   - labels: users, auth, p1-core-value

---

## 12) Quick wins para abrir o Linear já com valor

Se quiser configurar e começar ainda hoje, eu sugiro abrir primeiro apenas com:

### Projects
- Foundation / Multi-tenant
- Auth & RBAC
- Security & Audit
- Dashboard & Operations
- Onboarding & Users

### Labels mínimas
- workspace
- rbac
- audit
- dashboard
- users
- auth
- structural
- p0-foundation
- p1-core-value

### Views mínimas
- Execution Board
- All Backlog
- Current Cycle
- Blocked
- Structural

---

## 13) Regras operacionais simples para começar

### Regra 1
Nada entra em **In Progress** sem critério de pronto mínimo.

### Regra 2
Itens grandes demais devem ser quebrados antes de execução.

### Regra 3
Issue estrutural sem link para documentação relevante tende a gerar retrabalho.

### Regra 4
Itens de IA não entram antes da base de scoping, RBAC e auditoria.

### Regra 5
`Blocked` deve sempre ter motivo explícito.

---

## 14) Automação inicial recomendada

Quando possível no Linear:
- ao mover para `In Progress`, exigir owner
- ao mover para `Blocked`, pedir motivo curto
- ao mover para `Done`, garantir checklist mínimo
- ao criar item com label `structural`, sugerir link para doc em `docs/`

---

## 15) Resumo do setup mínimo viável

Se a ideia for configurar rápido sem perder robustez:

### Criar agora
- 1 team
- 7 status
- ciclos quinzenais
- 5 projects principais
- 10 labels principais
- 5 views
- 7 épicos estratégicos
- backlog inicial do ciclo 1

### Resultado esperado
Em poucas horas, o Guardian já passa a ter:
- backlog visual
- execução organizada
- ligação entre estratégia e trabalho diário
- estrutura boa para escalar depois

---

## 16) Próximo passo após configurar

Depois do setup, o ideal é:
1. cadastrar os épicos
2. criar as 10 primeiras issues do ciclo 1
3. vincular cada frente aos docs relevantes
4. começar pelo bloco P0
5. revisar semanalmente e ajustar com base no fluxo real
