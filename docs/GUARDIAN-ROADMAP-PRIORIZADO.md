# GUARDIAN-ROADMAP-PRIORIZADO.md

Roadmap priorizado do produto **Guardian** considerando:
- impacto no produto e no negócio,
- esforço de implementação,
- complexidade técnica,
- dependências estruturais,
- e coerência com a direção estratégica definida em `docs/GUARDIAN-PRODUTO-DIRECAO-ESTRATEGICA.md`.

> Objetivo: transformar a direção estratégica do Guardian em um plano de evolução pragmático.

---

## 1) Como ler este roadmap

Cada frente recebe três avaliações:

- **Impacto**: baixo / médio / alto / muito alto
- **Esforço**: baixo / médio / alto
- **Complexidade**: baixa / média / alta

### Diferença entre esforço e complexidade
- **Esforço** = quantidade de trabalho / tempo / áreas tocadas 
- **Complexidade** = dificuldade técnica, risco estrutural, dependências e chance de regressão

Também classificamos a prioridade prática em:
- **P0** — fundação crítica
- **P1** — alto valor, deve entrar cedo
- **P2** — importante, mas depende de base melhor
- **P3** — estratégico de médio prazo
- **P4** — avançado / futuro

---

## 2) Critério central de priorização

No Guardian, a ordem correta de valor tende a ser:

1. **garantir isolamento, segurança e governança**
2. **melhorar a operação diária do usuário**
3. **aumentar visibilidade e capacidade de decisão**
4. **introduzir automação útil**
5. **introduzir IA com escopo e governança**

Se um item parece moderno mas depende de base frágil, ele deve ser adiado.

---

## 3) Panorama geral das frentes prioritárias

| Frente | Impacto | Esforço | Complexidade | Prioridade |
|---|---|---:|---:|---|
| Workspace ativo + scoping completo | Muito alto | Alto | Alta | P0 |
| RBAC consistente | Muito alto | Alto | Alta | P0 |
| Auditoria e trilha de ações | Muito alto | Médio | Média | P0 |
| Onboarding por convite | Alto | Médio | Média | P1 |
| Dashboard operacional por exceção | Alto | Médio | Média | P1 |
| Padronização de domínio/status/fluxos | Alto | Médio | Média | P1 |
| Parametrização por workspace | Alto | Alto | Alta | P1 |
| Activity stream / histórico operacional | Alto | Médio | Média | P1 |
| Dashboards analíticos por módulo | Alto | Médio | Média | P2 |
| Motor simples de regras e alertas | Alto | Médio | Média/Alta | P2 |
| Integrações transacionais prioritárias | Alto | Alto | Alta | P2 |
| Observabilidade e saúde operacional | Médio/Alto | Médio | Média | P2 |
| Base de eventos para inteligência | Alto | Alto | Alta | P2 |
| Insights preditivos por módulo | Alto | Alto | Alta | P3 |
| Copiloto operacional | Alto | Alto | Alta | P3 |
| Marketplace/ecossistema extensível | Médio/Alto | Alto | Alta | P4 |
| Automação assistida mais avançada | Alto | Alto | Alta | P4 |

> Observação: a tabela é de priorização estratégica, não de cronograma exato.

---

## 4) Roadmap por prioridade

# P0 — Fundação crítica

Esses itens sustentam todo o resto. Sem eles, o Guardian corre risco de crescer sobre uma base errada.

## 4.1) Workspace ativo na sessão + scoping completo por `workspaceId`

### O que é
- incluir `workspaceId`, `workspaceRole` e sinalizações relevantes na sessão
- aplicar filtro consistente por workspace em páginas, APIs, queries e operações administrativas
- tratar troca de contexto de workspace de forma segura quando houver multi-workspace no futuro

### Impacto
**Muito alto**

### Esforço
**Alto**

### Complexidade
**Alta**

### Por que entra primeiro
Porque isso define o isolamento de tenant e evita que o sistema cresça com vazamento lógico entre clientes.

### Resultado esperado
- base multi-tenant real
- menos risco estrutural
- clareza para evolução do produto

---

## 4.2) RBAC consistente

### O que é
- consolidar papéis globais e por workspace
- garantir autorização coerente entre UI, APIs e ações administrativas
- reduzir lógica espalhada e inconsistência de permissão

### Impacto
**Muito alto**

### Esforço
**Alto**

### Complexidade
**Alta**

### Resultado esperado
- segurança melhor
- menos comportamento inconsistente
- base para parametrização, automação e IA segura no futuro

---

## 4.3) Auditoria e rastreabilidade operacional

### O que é
- fortalecer trilha de ações críticas
- tornar histórico de eventos útil para suporte, segurança e análise
- padronizar autoria e alteração (`createdById`, `updatedById`, timestamps, actor, severity)

### Impacto
**Muito alto**

### Esforço
**Médio**

### Complexidade
**Média**

### Resultado esperado
- confiança no produto
- debugging e suporte melhores
- base futura para alertas, automação e insights

---

# P1 — Valor alto logo após a fundação

Esses itens melhoram muito a utilidade percebida do produto sem depender de uma camada “fancy”.

## 4.4) Onboarding por convite e governança de usuário

### O que é
- fluxo robusto de convite
- ativação com token próprio
- criação controlada de membros por workspace
- notificações operacionais para ações sensíveis

### Impacto
**Alto**

### Esforço
**Médio**

### Complexidade
**Média**

### Resultado esperado
- crescimento organizado do produto
- menos fricção administrativa
- mais segurança no acesso

---

## 4.5) Dashboard operacional por exceção

### O que é
Transformar a home em uma central de atenção operacional, mostrando:
- pendências críticas
- riscos imediatos
- itens vencidos / atrasados
- ações administrativas pendentes
- alertas por prioridade

### Impacto
**Alto**

### Esforço
**Médio**

### Complexidade
**Média**

### Resultado esperado
- produto mais útil no dia a dia
- menos navegação “cega” por menu
- maior percepção de valor

---

## 4.6) Padronização de domínio, status e fluxos

### O que é
Padronizar conceitos do sistema, como:
- nomes de status
- transições permitidas
- convenções de lifecycle por módulo
- regras de validação de negócio
- semântica entre UI, API e banco

### Impacto
**Alto**

### Esforço
**Médio**

### Complexidade
**Média**

### Resultado esperado
- menos ambiguidade
- menos bugs de processo
- melhor base para métricas, automação e IA

### Observação
Este item é menos “visível” que dashboard, mas provavelmente entrega mais valor estrutural do que parece.

---

## 4.7) Parametrização por workspace

### O que é
Criar espaço para cada cliente configurar aspectos do sistema sem customização manual do código.

### Exemplos
- preferências operacionais
- limites, prazos e políticas
- numeração / documentos / defaults
- módulos habilitados
- políticas por papel
- temas leves e ajustes de apresentação
- regras específicas de operação

### Impacto
**Alto**

### Esforço
**Alto**

### Complexidade
**Alta**

### Resultado esperado
- produto mais vendável e escalável
- menor necessidade de variações por código
- base para verticalização gradual

### Observação estratégica
Parametrização boa é um diferencial forte de ERP moderno. Mas precisa vir depois de uma base de domínio e segurança mais sólida.

---

## 4.8) Activity stream / histórico operacional confiável

### O que é
Uma timeline operacional útil por workspace, entidade ou contexto.

### Impacto
**Alto**

### Esforço
**Médio**

### Complexidade
**Média**

### Resultado esperado
- mais clareza operacional
- melhor experiência de suporte
- base de verdade para automações e copiloto no futuro

---

# P2 — Estruturação de inteligência operacional

Esses itens já tornam o Guardian mais moderno, mas dependem de base operacional confiável.

## 4.9) Dashboards analíticos por módulo

### O que é
Construir visões analíticas realmente úteis, por exemplo:
- vendas
- financeiro
- estoque
- compras
- entregas
- administração

### Impacto
**Alto**

### Esforço
**Médio**

### Complexidade
**Média**

### Resultado esperado
- aumento de visibilidade
- suporte a decisão
- produto mais competitivo

### Risco
Dashboard sem dado confiável vira maquiagem. Por isso ele deve nascer depois da base de domínio e scoping.

---

## 4.10) Motor simples de regras, alertas e exceções

### O que é
Permitir que o Guardian detecte e aponte situações como:
- estoque abaixo de mínimo
- recebível em risco
- convite parado
- entrega atrasada
- ação administrativa sensível
- inconsistência de cadastro ou fluxo

### Impacto
**Alto**

### Esforço
**Médio**

### Complexidade
**Média/Alta**

### Resultado esperado
- menos trabalho manual de supervisão
- base de automação útil
- produto mais proativo

---

## 4.11) Integrações transacionais prioritárias

### O que é
Conectar o Guardian a serviços que aumentem valor operacional real.

### Possíveis prioridades
- e-mail transacional
- lookup de códigos/barras e catálogo
- pagamentos/cobrança
- fiscal/documentos
- logística/entregas
- OCR/documentos
- mensageria operacional

### Impacto
**Alto**

### Esforço
**Alto**

### Complexidade
**Alta**

### Resultado esperado
- redução de trabalho manual
- maior aderência ao fluxo real do cliente
- mais utilidade do produto

### Recomendação
Começar por integrações de maior aderência ao caso de uso atual, e não por número de integrações.

---

## 4.12) Observabilidade e saúde operacional

### O que é
Melhorar visibilidade técnica do produto em operação:
- logs estruturados
- métricas básicas
- saúde de jobs/processos
- falhas de integrações
- rastreamento de erros por módulo

### Impacto
**Médio/Alto**

### Esforço
**Médio**

### Complexidade
**Média**

### Resultado esperado
- melhor suporte
- melhor operação em produção
- menos tempo perdido em troubleshooting

---

## 4.13) Base de eventos para inteligência e workflow

### O que é
Criar uma base consistente de eventos operacionais reutilizáveis para:
- alertas
- timeline
- automações
- dashboards
- copiloto
- analytics e anomalias

### Impacto
**Alto**

### Esforço
**Alto**

### Complexidade
**Alta**

### Resultado esperado
- evita retrabalho estrutural depois
- dá coesão a vários recursos futuros

### Observação estratégica
Esse é um item de altíssimo valor arquitetural, mesmo que pouco visível ao usuário final no começo.

---

# P3 — Inteligência aplicada e diferenciação real

Aqui o Guardian começa a se diferenciar de forma mais clara, desde que a base anterior exista.

## 4.14) Insights preditivos por módulo

### O que é
Modelos ou heurísticas que ajudem a prever:
- atraso em recebíveis
- ruptura de estoque
- anomalia financeira
- queda de recorrência de cliente
- tendências operacionais simples

### Impacto
**Alto**

### Esforço
**Alto**

### Complexidade
**Alta**

### Resultado esperado
- produto mais inteligente de verdade
- vantagem competitiva prática
- maior valor percebido por gestor/operação

### Observação
Não precisa começar com ML sofisticado. Regras e heurísticas já podem entregar muito valor no começo.

---

## 4.15) Copiloto operacional

### O que é
Uma camada assistiva para:
- resumir situação do workspace
- explicar alertas e exceções
- sugerir próxima ação
- responder perguntas contextualizadas
- montar follow-ups e resumos

### Impacto
**Alto**

### Esforço
**Alto**

### Complexidade
**Alta**

### Resultado esperado
- experiência moderna e diferenciada
- redução de atrito operacional
- ponte natural para IA útil

### Regra importante
O copiloto deve ser assistivo e auditável, não uma caixa-preta autônoma.

---

# P4 — Camadas avançadas de ecossistema e automação madura

Esses itens são importantes, mas devem entrar quando o produto já tiver identidade operacional sólida.

## 4.16) Marketplace / ecossistema extensível

### O que é
Capacidade de adicionar extensões, conectores, módulos ou integrações de forma mais padronizada.

### Impacto
**Médio/Alto**

### Esforço
**Alto**

### Complexidade
**Alta**

### Resultado esperado
- escalabilidade de produto/ecossistema
- maior capacidade de adaptação por vertical/cliente

### Observação
É muito poderoso, mas cedo demais pode distrair do núcleo do produto.

---

## 4.17) Automação assistida avançada

### O que é
Fluxos mais sofisticados em que o sistema:
- sugere,
- prepara,
- e em alguns casos executa com confirmação,
com trilha clara e governança forte.

### Impacto
**Alto**

### Esforço
**Alto**

### Complexidade
**Alta**

### Resultado esperado
- ganho de produtividade significativo
- experiência mais moderna e competitiva

### Risco
Sem boa auditoria, permissões e eventos, isso vira fonte de erro e perda de confiança.

---

## 5) Mapa rápido: alto impacto vs baixo esforço

## 5.1) Ganhos rápidos mais interessantes
Esses são os itens com melhor relação valor / custo no curto prazo:

1. **auditoria e trilha operacional mais útil**
2. **dashboard por exceção**
3. **activity stream / histórico confiável**
4. **padronização de status e fluxos**
5. **onboarding por convite bem fechado**
6. **observabilidade básica de produção**

Se eu tivesse que escolher alguns quick wins estratégicos, seriam esses.

---

## 5.2) Itens de alto impacto e alto custo, mas inevitáveis
1. **workspace ativo + scoping completo**
2. **RBAC consistente**
3. **parametrização por workspace**
4. **integrações transacionais relevantes**
5. **base de eventos reutilizável**
6. **copiloto operacional**

Esses itens exigem mais cuidado, mas são os que realmente mudam o nível do produto.

---

## 6) Ordem recomendada de execução realista

### Onda 1 — Consolidar fundação
- workspace ativo na sessão
- scoping completo por `workspaceId`
- RBAC consistente
- auditoria/trilha forte

### Onda 2 — Elevar o valor diário do produto
- onboarding por convite
- dashboard por exceção
- activity stream
- padronização de status/fluxos

### Onda 3 — Preparar produto para escalar com coerência
- parametrização por workspace
- dashboards analíticos por módulo
- observabilidade
- motor simples de alertas/regras

### Onda 4 — Expandir o valor operacional
- integrações prioritárias
- base de eventos mais robusta
- insights e previsões simples

### Onda 5 — Diferenciação avançada
- copiloto operacional
- automação assistida avançada
- ecossistema/extensibilidade

---

## 7) Recomendações específicas por tema pedido

## 7.1) Integrações
### Prioridade
**P2**

### Recomendação
Integrar primeiro o que reduz trabalho manual e aumenta aderência ao fluxo real.

### Ordem sugerida
1. e-mail / notificações transacionais
2. códigos de barras / catálogos
3. pagamentos/cobrança
4. logística/entregas
5. OCR/documentos
6. fiscal
7. mensageria operacional

---

## 7.2) IA
### Prioridade
**P3**

### Recomendação
Entrar primeiro como:
- alertas,
- explicações,
- resumos,
- recomendação,
- previsão simples,
- copiloto assistivo.

### Não começar por
- agente autônomo genérico
- chat como centro do produto
- decisões críticas sem confirmação

---

## 7.3) Padronização
### Prioridade
**P1**

### Recomendação
Padronizar cedo:
- status
- ciclos de vida
- eventos
- nomes de domínio
- contratos de API
- terminologia entre front, back e banco

Esse é um investimento que reduz custo futuro em tudo.

---

## 7.4) Parametrização
### Prioridade
**P1**

### Recomendação
Construir gradualmente, mas com modelo claro desde cedo.

Começar por:
- configurações do workspace
- políticas operacionais
- módulos habilitados
- defaults e preferências
- opções de comportamento por domínio

---

## 7.5) Dashboards
### Prioridade
**dashboard operacional = P1**
**dashboards analíticos = P2**

### Recomendação
Separar claramente:
- **dashboard operacional** → o que exige ação agora
- **dashboard analítico** → o que ajuda a entender tendência e performance

Misturar os dois cedo demais tende a piorar a UX.

---

## 7.6) Automação
### Prioridade
**P2 → P4**

### Recomendação
Começar com:
- alertas e regras simples
- lembretes e filas
- sugestões de ação

Só depois avançar para automação assistida e semi-executiva.

---

## 7.7) Governança e segurança
### Prioridade
**P0 permanente**

### Recomendação
Nunca sair do topo da lista.
No Guardian, esse é núcleo do produto, não detalhe técnico.

---

## 8) Matriz final de prioridade prática

## Fazer primeiro
- workspace ativo
- scoping por workspace
- RBAC
- auditoria

## Fazer logo depois
- onboarding por convite
- dashboard operacional por exceção
- padronização de fluxos/status
- histórico operacional

## Fazer em seguida
- parametrização por workspace
- dashboards analíticos
- alertas/regras
- observabilidade

## Fazer como diferenciação
- integrações prioritárias
- insights preditivos
- copiloto operacional

## Fazer quando o produto estiver maduro
- automação assistida avançada
- ecossistema/extensibilidade avançada

---

## 9) Conclusão executiva

Se o Guardian quiser nascer moderno sem se perder, a melhor estratégia é:

1. **arrumar a base multi-tenant e de governança**
2. **ficar excelente na operação diária**
3. **criar visibilidade real do negócio**
4. **automatizar o que é repetitivo e previsível**
5. **introduzir IA como camada de apoio, não como espetáculo**

Em resumo:

> O Guardian deve priorizar primeiro **controle, segurança, rastreabilidade e contexto**; depois **dashboards, parametrização e integrações**; e só então escalar para **IA, copiloto e automação mais avançada**.
