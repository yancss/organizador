# Security Review (API routes)

Generated: 2026-03-29T00:07:12.373Z

Scope: src/app/api/**/route.ts (write operations)

## Summary
- Total API route files: **71**
- Routes with Prisma writes detected: **44**

## CRITICAL (3)
- `src/app/api/auth/forgot-password/route.ts` — **NO_AUTH_GUARD** — writes: passwordResetToken.create.
- `src/app/api/auth/reset-password/route.ts` — **NO_AUTH_GUARD** — writes: user.update, passwordResetToken.update.
- `src/app/api/cron/audit-cleanup/route.ts` — **NO_AUTH_GUARD** — writes: auditEvent.deleteMany.

## HIGH (1)
- `src/app/api/admin/users/[id]/session-policy/route.ts` — **requireWorkspace/requireAdmin** — writes: user.update.

## MED (0)
- (none)

## LOW (40)
- `src/app/api/admin/invites/route.ts` — **requireWorkspace/requireAdmin** — writes: userInviteToken.create.
- `src/app/api/admin/roles/[id]/route.ts` — **requireWorkspace/requireAdmin** — writes: workspaceRoleModel.update, workspaceRoleModel.delete.
- `src/app/api/admin/roles/route.ts` — **requireWorkspace/requireAdmin** — writes: workspaceRoleModel.create.
- `src/app/api/admin/settings/audit-retention/route.ts` — **requireWorkspace/requireAdmin** — writes: workspaceSetting.upsert, auditEvent.create.
- `src/app/api/admin/users/[id]/password-reset/route.ts` — **requireWorkspace/requireAdmin** — writes: passwordResetToken.create. FK: userId
- `src/app/api/clients/[id]/route.ts` — **requireWorkspace/requireAdmin** — writes: client.updateMany, client.deleteMany.
- `src/app/api/clients/route.ts` — **requireWorkspace/requireAdmin** — writes: client.create.
- `src/app/api/deliveries/[id]/route.ts` — **requireWorkspace/requireAdmin** — writes: delivery.update, delivery.deleteMany. FK: productId, clientId, salesOrderId, deliveryId
- `src/app/api/deliveries/route.ts` — **requireWorkspace/requireAdmin** — writes: delivery.create. FK: productId, clientId, salesOrderId
- `src/app/api/events/[id]/route.ts` — **requireWorkspace/requireAdmin** — writes: salesOrder.updateMany, salesOrder.deleteMany.
- `src/app/api/events/route.ts` — **requireWorkspace/requireAdmin** — writes: salesOrder.create.
- `src/app/api/finance/accounts/[id]/route.ts` — **requireWorkspace/requireAdmin** — writes: financialAccount.update, financialAccount.update.
- `src/app/api/finance/accounts/route.ts` — **requireWorkspace/requireAdmin** — writes: financialAccount.create.
- `src/app/api/finance/categories/[id]/route.ts` — **requireWorkspace/requireAdmin** — writes: financialCategory.update, financialCategory.update.
- `src/app/api/finance/categories/route.ts` — **requireWorkspace/requireAdmin** — writes: financialCategory.create.
- `src/app/api/finance/cost-centers/[id]/route.ts` — **requireWorkspace/requireAdmin** — writes: costCenter.update, costCenter.update.
- `src/app/api/finance/cost-centers/route.ts` — **requireWorkspace/requireAdmin** — writes: costCenter.create.
- `src/app/api/finance/entries/[id]/route.ts` — **requireWorkspace/requireAdmin** — writes: financialEntry.update, financialEntry.delete. FK: accountId, categoryId, costCenterId
- `src/app/api/finance/entries/route.ts` — **requireWorkspace/requireAdmin** — writes: financialAccount.create, financialEntry.create. FK: salesOrderId, purchaseOrderId, accountId, categoryId, costCenterId
- `src/app/api/inventory/[productId]/route.ts` — **requireWorkspace/requireAdmin** — writes: inventory.update. FK: productId
- `src/app/api/me/route.ts` — **requireWorkspace/requireAdmin** — writes: user.update.
- `src/app/api/orders/[id]/route.ts` — **requireWorkspace/requireAdmin** — writes: salesOrder.updateMany, auditEvent.create, auditEvent.create, salesOrderItem.deleteMany, salesOrderItem.createMany, salesOrder.updateMany, salesOrder.deleteMany. FK: productId, clientId, salesOrderId
- `src/app/api/orders/route.ts` — **requireWorkspace/requireAdmin** — writes: salesOrder.create. FK: productId, clientId, userId
- `src/app/api/payments/[id]/route.ts` — **requireWorkspace/requireAdmin** — writes: payment.update, payment.deleteMany. FK: clientId, salesOrderId, receivableId
- `src/app/api/payments/route.ts` — **requireWorkspace/requireAdmin** — writes: payment.create. FK: clientId, salesOrderId, receivableId
- `src/app/api/products/[id]/barcodes/[barcodeId]/route.ts` — **requireWorkspace/requireAdmin** — writes: productBarcode.deleteMany, auditEvent.create. FK: productId
- `src/app/api/products/[id]/barcodes/route.ts` — **requireWorkspace/requireAdmin** — writes: productBarcode.create, auditEvent.create. FK: productId
- `src/app/api/products/[id]/route.ts` — **requireWorkspace/requireAdmin** — writes: product.updateMany, auditEvent.create, product.updateMany.
- `src/app/api/products/route.ts` — **requireWorkspace/requireAdmin** — writes: product.create.
- `src/app/api/purchase-orders/[id]/route.ts` — **requireWorkspace/requireAdmin** — writes: purchaseOrder.delete. FK: productId, purchaseOrderId
- `src/app/api/purchase-orders/route.ts` — **requireWorkspace/requireAdmin** — writes: purchaseOrder.create. FK: productId, purchaseOrderId
- `src/app/api/purchases/[id]/route.ts` — **requireWorkspace/requireAdmin** — writes: purchase.update.
- `src/app/api/purchases/route.ts` — **requireWorkspace/requireAdmin** — writes: purchase.create. FK: productId
- `src/app/api/receivables/[id]/route.ts` — **requireWorkspace/requireAdmin** — writes: receivable.update. FK: clientId, salesOrderId, deliveryId, receivableId
- `src/app/api/recipes/[id]/items/[itemId]/route.ts` — **requireWorkspace/requireAdmin** — writes: recipeItem.updateMany, recipeItem.deleteMany.
- `src/app/api/recipes/[id]/items/route.ts` — **requireWorkspace/requireAdmin** — writes: recipeItem.create. FK: productId
- `src/app/api/recipes/[id]/route.ts` — **requireWorkspace/requireAdmin** — writes: recipe.updateMany, recipe.deleteMany. FK: productId
- `src/app/api/recipes/route.ts` — **requireWorkspace/requireAdmin** — writes: recipe.create. FK: productId
- `src/app/api/refunds/[id]/route.ts` — **requireWorkspace/requireAdmin** — writes: refund.update, refund.deleteMany. FK: clientId, salesOrderId, receivableId
- `src/app/api/refunds/route.ts` — **requireWorkspace/requireAdmin** — writes: refund.create. FK: clientId, salesOrderId

## Notes / how to interpret
This is a heuristic scan. Items marked MED/HIGH need manual review of workspace scoping and ownership checks.
