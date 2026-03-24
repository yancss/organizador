# Pente-fino de documentação — 2026-03-23

Este relatório foi gerado automaticamente comparando:
- `prisma/schema.prisma` (models/enums)
- `src/app/app/**/page.*` (rotas de UI)
- `src/app/api/**/route.*` (rotas de API)
- `docs/*.md` + `README.md` (conteúdo documentado)

## 1) Rotas de UI existentes (src/app/app)
Total: 29

- `/app`
- `/app/admin/audit`
- `/app/admin/roles`
- `/app/admin/security`
- `/app/admin/users`
- `/app/clients`
- `/app/costs`
- `/app/deliveries`
- `/app/deliveries/[id]`
- `/app/finance`
- `/app/finance/accounts`
- `/app/finance/categories`
- `/app/finance/payables`
- `/app/finance/receivables`
- `/app/finance/receivables/[id]`
- `/app/finance/refunds`
- `/app/history`
- `/app/home`
- `/app/inventory`
- `/app/payments`
- `/app/products`
- `/app/profile`
- `/app/purchases/orders`
- `/app/receivables`
- `/app/recipes`
- `/app/refunds`
- `/app/sales/orders`
- `/app/sales/orders/[id]`
- `/app/settings`

## 2) Rotas de API existentes (src/app/api)
Total: 63

- `/api/address/br`
- `/api/address/pt`
- `/api/admin/audit/events`
- `/api/admin/invites`
- `/api/admin/roles`
- `/api/admin/roles/[id]`
- `/api/admin/roles/[id]/permissions`
- `/api/admin/settings/audit-retention`
- `/api/admin/users`
- `/api/admin/users/[id]`
- `/api/admin/users/[id]/password-reset`
- `/api/admin/users/[id]/roles`
- `/api/admin/users/[id]/session-policy`
- `/api/auth/[...nextauth]`
- `/api/auth/activate`
- `/api/auth/forgot-password`
- `/api/auth/reset-password`
- `/api/clients`
- `/api/clients/[id]`
- `/api/cron/audit-cleanup`
- `/api/dashboard`
- `/api/debug/me`
- `/api/deliveries`
- `/api/deliveries/[id]`
- `/api/events`
- `/api/events/[id]`
- `/api/finance/accounts`
- `/api/finance/accounts/[id]`
- `/api/finance/categories`
- `/api/finance/categories/[id]`
- `/api/finance/cost-centers`
- `/api/finance/cost-centers/[id]`
- `/api/finance/entries`
- `/api/finance/entries/[id]`
- `/api/finance/reports/costs`
- `/api/inventory`
- `/api/inventory/[productId]`
- `/api/me`
- `/api/orders`
- `/api/orders/[id]`
- `/api/orders/export/csv`
- `/api/orders/export/pdf`
- `/api/orders/search`
- `/api/payments`
- `/api/payments/[id]`
- `/api/production`
- `/api/products`
- `/api/products/[id]`
- `/api/purchase-orders`
- `/api/purchase-orders/[id]`
- `/api/purchases`
- `/api/purchases/[id]`
- `/api/receivables`
- `/api/receivables/[id]`
- `/api/recipes`
- `/api/recipes/[id]`
- `/api/recipes/[id]/items`
- `/api/recipes/[id]/items/[itemId]`
- `/api/refunds`
- `/api/refunds/[id]`
- `/api/tasks`
- `/api/users`
- `/api/users/lookup`

## 3) Possíveis faltas no docs/PROJECT.md
> Heurística: busca simples por menção textual da rota. Pode dar falso-positivo/falso-negativo.

### 3.1) UI routes não mencionadas (0)
- (nenhuma)

### 3.2) API routes não mencionadas (0)
- (nenhuma)

## 4) Models/enums no Prisma
Models (37): Account, AuditEvent, Client, Consumption, CostCenter, Delivery, DeliveryItem, FinancialAccount, FinancialCategory, FinancialEntry, Inventory, PasswordResetToken, Payment, PaymentApplication, Permission, PostalPt, Product, Purchase, PurchaseOrder, PurchaseOrderItem, Receivable, Recipe, RecipeItem, Refund, SalesOrder, SalesOrderItem, Session, User, UserInviteToken, VerificationToken, Workspace, WorkspaceMember, WorkspaceRoleModel, WorkspaceRolePermission, WorkspaceSequence, WorkspaceSetting, WorkspaceUserRole

Enums (20): AuditAction, AuditCategory, ClientEntityType, DeliveryMethod, DeliveryStatus, DiscountType, FinancialEntryStatus, FinancialEntryType, PaymentMethod, PaymentStatus, ProductKind, PurchaseOrderStatus, ReceivableStatus, RefundMethod, RefundStatus, SalesOrderDiscountMode, SalesOrderStatus, StakeholderRole, UserRole, WorkspaceRole

## 5) Checagem do docs/ID-PREFIXES.md
Models não encontrados no arquivo (por nome): 0
- (ok)

## 6) Menções potencialmente desatualizadas / legado (busca literal)
### "Event" (4)
- docs/data-model-current-2026-03-11.md
- docs/data-model-current-2026-03-11_after_split.md
- docs/DOCS-AUDIT-2026-03-23.md
- docs/ID-PREFIXES.md

### "OrderItem" (4)
- docs/data-model-current-2026-03-11.md
- docs/data-model-current-2026-03-11_after_split.md
- docs/DOCS-AUDIT-2026-03-23.md
- docs/ID-PREFIXES.md

### "antes de PV/Entrega/Recebíveis" (1)
- docs/DOCS-AUDIT-2026-03-23.md

### "/api/events" (2)
- docs/DOCS-AUDIT-2026-03-23.md
- docs/PROJECT.md

### "/app/purchases" (2)
- docs/DOCS-AUDIT-2026-03-23.md
- docs/PROJECT.md

### "Order" (6)
- docs/data-model-current-2026-03-11.md
- docs/data-model-current-2026-03-11_after_split.md
- docs/data-model-sales-flow-v1.md
- docs/DOCS-AUDIT-2026-03-23.md
- docs/ID-PREFIXES.md
- docs/PROJECT.md
