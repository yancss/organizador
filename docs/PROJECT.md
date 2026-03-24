# Organizador — Documentação do Projeto (robusta)

> Arquivo único com visão completa do projeto: setup, deploy, arquitetura, auth, workspaces, APIs, decisões e roadmap.

## 1) Visão geral
Aplicação para organização/gestão com:
- **Next.js (App Router)**
- **Prisma + PostgreSQL** (Neon)
- **NextAuth** (Credentials) + **sessão JWT**

Objetivo de produto:
- Multi-tenant via **1 workspace = 1 cliente**
- Gestão de usuários por convite
- Perfis (roles) com ações restritas (Admin/Superadmin)

---

## 2) Stack e dependências principais
- `next` (App Router)
- `prisma` / `@prisma/client`
- `next-auth` v4
- `@next-auth/prisma-adapter`
- `bcryptjs`
- `nodemailer` (infra de e-mail)

Scripts relevantes (`package.json`):
- `npm run dev`
- `npm run build` (gera Prisma Client + build)
- `postinstall`: `prisma generate`

---

## 3) Setup local

### 3.0) Padrão de IDs (dev/seed)
Ver: `docs/ID-PREFIXES.md`
### 3.1) Instalação
```bash
npm i
```

### 3.2) Variáveis de ambiente
Use `.env.example` como base.

Obrigatórias:
- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

E-mail (config):
- SMTP via `nodemailer` **ou** Resend (variáveis já documentadas em `.env.example`)

### 3.3) Banco e migrations
Dev (gera/aplica migrations):
```bash
npx prisma migrate dev
```

Produção/deploy (aplica migrations existentes):
```bash
npx prisma migrate deploy
```

**Observação Neon + pooler/pgbouncer**
- Em runtime, é comum usar pooler com `pgbouncer=true`.
- Para migrations, o ideal é usar `DIRECT_URL` com conexão direta (sem pooler), quando disponível.

---

## 4) Deploy (Vercel)
### 4.1) Build command recomendado
Garanta migrations + generate antes do build:
```bash
npx prisma migrate deploy && npx prisma generate && npm run build
```

### 4.2) Erros Prisma comuns (e como resolver)
**P3005 — The database schema is not empty**
- Causa: tentando `migrate deploy` em schema já populado sem baseline.
- Solução (se DB puder ser apagado): resetar schema `public` e depois `migrate deploy`.

**P2003 — Foreign key constraint violated**
- Causa: criar registro filho apontando pra `userId` inexistente (ex.: WorkspaceMember sem User).
- Solução: criar/garantir o User antes (upsert) ou usar `connect`/`connectOrCreate`.

**P2022 — column does not exist**
- Causa: Prisma Client espera coluna que o DB não tem (migrations não aplicadas no ambiente).
- Solução: aplicar migrations no DB correto; garantir que Vercel está usando o mesmo `DATABASE_URL`.

### 4.3) Histórico recente (migrations)
Foi criada uma migration para alinhar o banco ao `schema.prisma` atual:
- `prisma/migrations/20260313135638_add_audit_fields/`
  - adiciona `createdById/updatedById` em múltiplas tabelas
  - adiciona `FinancialEntry.purchaseOrderId` + índice + FK

---

## 5) Autenticação (NextAuth)
### 5.1) Local do código
- Handler: `src/app/api/auth/[...nextauth]/route.ts`
- Opções: `src/lib/auth.ts`

### 5.2) Como funciona
- Provider: **Credentials** (email/senha)
- Validação:
  - busca usuário por email
  - bloqueia se `active=false`
  - bloqueia se `passwordHash` ausente
  - compara bcrypt
- Sessões: `strategy: 'jwt'`
- `session.user.id` é preenchido a partir de `token.sub`

### 5.3) Rotas de auth
- UI:
  - `/login`
  - `/register`
  - `/forgot-password`
  - `/reset-password`
  - `/activate` (ativação via convite)
- API:
  - `src/app/api/auth/forgot-password/route.ts`
  - `src/app/api/auth/reset-password/route.ts`
  - `src/app/api/auth/activate/route.ts`
  - `src/app/api/auth/[...nextauth]/route.ts`

---

## 6) Workspaces (multi-tenant)
### 6.1) Conceito
- **Workspace = Cliente (tenant)**
- Dados devem ser sempre filtrados por `workspaceId`.

### 6.2) Estado atual
- Projeto está operando com **1 workspace** hoje.
- Ainda pode haver endpoints/pages que não impõem scoping estrito.

### 6.3) Direção (planejada)
Adicionar “workspace ativo” na sessão (NextAuth):
- `workspaceId`
- `workspaceRole` (ADMIN/USER)
- `isSuperadmin`

Regra para agora (1 workspace):
- resolver como “primeiro WorkspaceMember do usuário”

Regra futura (vários workspaces):
- sessão guarda `activeWorkspaceId`
- troca via endpoint protegido (sem listar todos os workspaces)

---

## 7) Perfis e permissões (RBAC) — em implementação
### 7.1) Papéis
Global (`User.role`):
- `SUPERADMIN` (Support Guardian)
- `USER`

Por workspace (`WorkspaceMember.role`):
- `ADMIN`
- `USER`

### 7.2) Support Guardian
- E-mail: `support.guardian.app@gmail.com`
- Deve existir sempre (seed/bootstrap idempotente)
- Deve ser membro (WorkspaceMember) do workspace do cliente onde vai operar
- **Sem UI com lista global** de clientes/workspaces

### 7.3) Onboarding via convite
Fluxo pro ADMIN:
1) convidar por e-mail
2) criar User (sem senha) + WorkspaceMember
3) gerar token
4) enviar link de ativação
5) usuário define senha

Recomendação: criar tabela `UserInviteToken` (separada de reset de senha).

### 7.4) Notificações para segurança
Ao criar um `WorkspaceMember`, enviar e-mail para o Support:
- “Usuário X foi vinculado ao workspace Y por Z em data/hora.”

---

## 8) Estrutura de pastas (alto nível)
- `src/app` — rotas (pages) e API Route Handlers
- `src/lib` — libs (prisma, auth, utilitários)
- `prisma/` — schema e migrations
- `docs/` — documentação e modelos
- `scripts/` — scripts auxiliares

---

## 9) Rotas da aplicação (App Router)
### 9.1) Páginas principais (estado atual)
- `/app` (área logada)
- `/app/home`
- `/app/clients`
- `/app/products`
- `/app/inventory`
- `/app/recipes`
- `/app/sales/orders` e `/app/sales/orders/[id]`
- `/app/purchases/orders` (UI de pedidos de compra)
- `/app/deliveries` e `/app/deliveries/[id]`
- `/app/receivables`
- `/app/payments`
- `/app/refunds`
- `/app/finance` (hub)
  - `/app/finance/accounts`
  - `/app/finance/categories`
  - `/app/finance/payables`
  - `/app/finance/receivables` e `/app/finance/receivables/[id]`
  - `/app/finance/refunds`
- `/app/costs`
- `/app/history`
- `/app/profile`
- `/app/settings`
- Admin:
  - `/app/admin/users`
  - `/app/admin/roles`
  - `/app/admin/security`
  - `/app/admin/audit`

### 9.2) APIs (Route Handlers) (estado atual)
Auth:
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/activate` (ativação via convite)
- `GET|POST /api/auth/[...nextauth]`

Dados (principais):
- `/api/clients` + `/api/clients/[id]`
- `/api/products` + `/api/products/[id]`
- `/api/inventory` + `/api/inventory/[productId]`
- `/api/recipes` + `/api/recipes/[id]`
- `/api/orders` + `/api/orders/search` + `/api/orders/[id]`
  - exports: `/api/orders/export/csv`, `/api/orders/export/pdf`
- `/api/purchase-orders` + `/api/purchase-orders/[id]`
- `/api/purchases` + `/api/purchases/[id]`
- `/api/deliveries` + `/api/deliveries/[id]`
- `/api/receivables` + `/api/receivables/[id]`
- `/api/payments` + `/api/payments/[id]`
- `/api/refunds` + `/api/refunds/[id]`
- `/api/recipes` + `/api/recipes/[id]`
  - items: `/api/recipes/[id]/items`, `/api/recipes/[id]/items/[itemId]`

Finance:
- `/api/finance/accounts` + `/api/finance/accounts/[id]`
- `/api/finance/categories` + `/api/finance/categories/[id]`
- `/api/finance/cost-centers` + `/api/finance/cost-centers/[id]`
- `/api/finance/entries` + `/api/finance/entries/[id]`
- `/api/finance/reports/costs`

Admin/Util/Cron/Lookup:
- `/api/me`
- `/api/users`
- `/api/users/lookup`
- `/api/dashboard`
- `/api/production`
- `/api/tasks`
- `/api/debug/me`
- `/api/address/pt`, `/api/address/br`
- `/api/cron/audit-cleanup`
- Admin:
  - `/api/admin/users` + `/api/admin/users/[id]`
  - `/api/admin/users/[id]/password-reset`
  - `/api/admin/users/[id]/roles`
  - `/api/admin/users/[id]/session-policy`
  - `/api/admin/roles` + `/api/admin/roles/[id]`
  - `/api/admin/roles/[id]/permissions`
  - `/api/admin/invites`
  - `/api/admin/audit/events`
  - `/api/admin/settings/audit-retention`

Legado (evitar usar em novos fluxos):
- `/api/events` + `/api/events/[id]`

> Observação: a lista acima é baseada na árvore de pastas. A semântica de cada endpoint deve ser revisada caso a caso.

---

## 10) Decisões (registro rápido)
### 10.1) Workspaces
- Decisão: 1 workspace = 1 cliente (tenant)
- Motivação: isolamento de dados e facilidade de personalização por cliente

### 10.2) Superadmin (Support Guardian)
- Decisão: Support Guardian como `SUPERADMIN`
- Operação: atua cliente a cliente, sem lista global

### 10.3) Onboarding
- Decisão: admin convida via e-mail; usuário cria senha via link

---

## 11) Próximos passos (checklist executável)
1) Implementar workspace ativo na sessão (NextAuth callbacks)
2) Aplicar scoping por `workspaceId` em todos os endpoints
3) Implementar RBAC (ADMIN/SUPERADMIN)
4) Implementar convites (`UserInviteToken`) + e-mails
5) Criar telas em `/app/settings`:
   - Gestão de Usuários
   - Gestão de Perfis/Permissões

