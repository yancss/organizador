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

## 6) Headers e Hardening (Next.js)
- Adicionar headers básicos:
  - `Content-Security-Policy` (mesmo que inicial)
  - `X-Frame-Options` / `frame-ancestors`
  - `Referrer-Policy`
  - `X-Content-Type-Options`

---

## 7) Pendências sugeridas (curto prazo)
1) Rate limit em `/api/auth/*`
2) Revisão de scoping `workspaceId` em todos os endpoints
3) Revisão RBAC (bloquear admin routes para não-admin)
4) Rodar varredura de endpoints que aceitam `id` e garantir ownership

---

## 8) Auditoria (2026-03-29) — achados principais
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
