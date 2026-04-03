# Segurança — Guardian (checklist + prioridades)

Este documento lista riscos e melhorias recomendadas. O objetivo é reduzir exposição a:
- vazamento cross-tenant (workspace)
- ações não autorizadas (RBAC)
- abuso de endpoints (rate limit)
- problemas clássicos de auth/session/CSRF

---

## 1) Auth / Sessão
### Recomendações
- Garantir `NEXTAUTH_SECRET` forte e único por ambiente.
- Cookies de sessão com:
  - `Secure` em produção
  - `SameSite=Lax` (ou `Strict` quando possível)
- Revisar rotas sensíveis para evitar comportamento inesperado com sessão inválida.

### Rate limit (prioridade alta)
Aplicar rate limit em:
- `/api/auth/*` (login, forgot/reset)
- endpoints de scan (`/api/*/scan`) para evitar abuso

Sugestão:
- middleware com IP + userId (quando logado)

---

## 2) Multi-tenant (workspaceId) — prioridade máxima
### Regra
Todo endpoint de dados deve filtrar por `workspaceId`.

Checklist:
- queries com `where: { workspaceId: wsId, ... }`
- validações/joins (ex.: ao conectar `productId`, garantir que o produto pertence ao mesmo workspace)

---

## 3) RBAC / Autorização
### Estado desejado
- `User.role` global (SUPERADMIN)
- `WorkspaceMember.role` por workspace (ADMIN/USER)

Regras típicas:
- ADMIN: CRUD em cadastros e gestão interna
- USER: operação (pedidos, etc.)

Implementação recomendada:
- helpers em `src/lib/authz`:
  - `requireWorkspace()` (já existe)
  - `requireRole('ADMIN')` por rota
  - `requirePermission('orders.write')` (futuro)

---

## 4) Proteções de API
- Validar Zod em todas as rotas (já é o padrão)
- Limitar campos retornados (`select`) para evitar leakage
- Garantir que operações de escrita são transacionais quando necessário

---

## 5) Logs / Auditoria
- Auditoria já existe (`AuditEvent`).
- Prioridade: garantir auditoria explícita em ações de alto sinal:
  - mudanças de status
  - mudanças em itens de pedido
  - vincular/remover barcode

---

## 6) Dependências (npm audit)
### Política
- Manter `npm audit --omit=dev` **zerado** (ou justificar exceções).
- Prioridade:
  1) **high/critical**
  2) moderate
  3) low

### Remediações aplicadas (2026-04-03)
- **Removido `xlsx`** do projeto (advisories high sem fix disponível; não havia uso no `src/`).
- **Atualizado `nodemailer` para `8.0.4`** (corrige advisory high reportado pelo `npm audit`).
  - Nota: `next-auth@4.24.13` declara `peerOptional nodemailer@^7.x`. Em installs recentes, pode ser necessário usar `npm i --legacy-peer-deps`.
- **Atualizado Prisma para `6.19.3`** (`prisma` e `@prisma/client`) para remover advisory high transitivo via `@prisma/config`/`effect`.
- **Atualizado Next.js para `16.2.2`** para remover advisory moderate (série 16.1.x estava afetada).

---

## 7) Headers e Hardening (Next.js)
- Adicionar headers básicos:
  - `Content-Security-Policy` (mesmo que inicial)
  - `X-Frame-Options` / `frame-ancestors`
  - `Referrer-Policy`
  - `X-Content-Type-Options`

---

## 8) Pendências sugeridas (curto prazo)
1) Rate limit em `/api/auth/*`
2) Revisão de scoping `workspaceId` em todos os endpoints
3) Revisão RBAC (bloquear admin routes para não-admin)
4) Rodar varredura de endpoints que aceitam `id` e garantir ownership

---

## 9) Auditoria (2026-03-29) — achados principais
### Ajustes já aplicados
- `DISABLE_AUTH` bloqueado fora de `NODE_ENV=development`.
- Rate limit (best-effort) no `middleware.ts` para:
  - `/api/auth/*`
  - `/api/barcodes/lookup`
  - `*/scan`
- `GET /api/debug/me` desativado fora de development.
- `PATCH /api/admin/users/[id]/session-policy` restrito a **SUPERADMIN**.

### Itens pendentes (ownership/workspace)
Rotas que aceitam IDs relacionados e **precisam validar ownership no workspace** (evitar vínculo cross-tenant):
- `POST /api/orders` (`src/app/api/orders/route.ts`): validar `clientId` no workspace.
- `POST /api/deliveries` (`src/app/api/deliveries/route.ts`): validar `items[].productId` no workspace + `kind=FINISHED`; validar/derivar `clientId`.
- `POST /api/payments` (`src/app/api/payments/route.ts`): se `clientId` for enviado, validar no workspace (ou remover do input e derivar do SalesOrder).
- `POST /api/refunds` (`src/app/api/refunds/route.ts`): se `clientId` for enviado, validar no workspace (ou remover do input e derivar de payment/salesOrder).
