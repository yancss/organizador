# Padrão oficial de IDs (DEV / dados de teste)

**Objetivo:** tornar IDs “líveis” e fáceis de depurar.

## Formato

Todos os IDs gerados no **seed/dev local** seguem:

- `<PREFIXO_3_LETRAS><10 dígitos sequenciais>`
- Ex.: `WKS0000000001`, `USR0000000001`

Sequência é **por prefixo** (cada tabela/modelo tem seu contador).

> Nota: isto é, por enquanto, um padrão **para dados de teste (seed)**.
> Para aplicar em bases já existentes/produção, é necessário um plano de migração (PK/FK) — não coberto neste documento.

## Prefixos por tabela/modelo (Prisma)

- `USR` User
- `ACC` Account
- `SES` Session
- `PRT` PasswordResetToken
- `VRT` VerificationToken

- `WKS` Workspace
- `WMB` WorkspaceMember
- `WSQ` WorkspaceSequence
- `WST` WorkspaceSetting

- `PRM` Permission
- `WRL` WorkspaceRoleModel
- `WRP` WorkspaceRolePermission
- `WUR` WorkspaceUserRole
- `UIT` UserInviteToken

- `CLT` Client
- `PPT` PostalPt

- `PRD` Product
- `INV` Inventory
- `PUR` Purchase
- `CNS` Consumption
- `RCP` Recipe
- `RCI` RecipeItem

- `SOR` SalesOrder
- `SOI` SalesOrderItem

- `POR` PurchaseOrder
- `POI` PurchaseOrderItem

- `DLV` Delivery
- `DLI` DeliveryItem
- `RCV` Receivable
- `PAY` Payment
- `PAP` PaymentApplication
- `RFD` Refund

- `FAC` FinancialAccount
- `FCA` FinancialCategory
- `CST` CostCenter
- `FEN` FinancialEntry

- `AUD` AuditEvent
