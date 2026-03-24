# Modelo de dados (snapshot histórico) — 2026-03-11

> **Atenção:** este arquivo é um retrato do schema na data acima e está **desatualizado** em relação ao `prisma/schema.prisma` atual.
> Para o estado atual, use:
> - `docs/PROJECT.md`
> - `docs/data-model-sales-flow-v1.md`
> - `prisma/schema.prisma`

Fonte: `prisma/schema.prisma` (PostgreSQL + Prisma)

## Visão geral (entidades principais)

### Workspace / Acesso
- **User**: usuários do sistema
- **Workspace**: “empresa/ambiente” (multi-tenant)
- **WorkspaceMember**: vínculo User↔Workspace (com role)

### Comercial / Operações
- **Client**: clientes (contato, identificação, endereço)
- **Product**: produtos/insumos (RAW|FINISHED), unidade padrão
- **Inventory**: posição de estoque por produto (qty + mínimo)
- **Order** (mapeado para tabela `Event`): pedidos (atual)
- **OrderItem**: itens do pedido (qtd por produto)

### Suprimentos / Produção
- **Purchase**: compras (entrada de estoque de um produto)
- **Consumption**: consumo (saída por produção; pode referenciar Order e/ou Recipe)
- **Recipe**: receita/BOM (produto final)
- **RecipeItem**: itens/insumos da receita

### Financeiro (MVP)
- **FinancialAccount**: conta (cash/bank/card/etc)
- **FinancialCategory**: categorias IN/OUT (hierárquica)
- **CostCenter**: centro de custo
- **FinancialEntry**: lançamentos (ledger) com:
  - competenceDate, paidAt
  - type IN/OUT
  - status PLANNED/PAID
  - links opcionais: orderId, purchaseId, consumptionId

### Auth (NextAuth)
- Account, Session, PasswordResetToken, VerificationToken

## Relacionamentos (alto nível)

- Workspace 1—N Client/Product/Inventory/Order/Purchase/Consumption/Recipe/Finance*
- Client 1—N Order
- Order 1—N OrderItem
- Product 1—N (OrderItem, Purchase, Consumption, RecipeItem) e 1—1 Inventory
- Recipe 1—N RecipeItem; Recipe 1—N Consumption
- FinancialEntry N—1 FinancialAccount; N—1 FinancialCategory?; N—1 CostCenter?
- FinancialEntry pode apontar (opcionalmente) para Order/Purchase/Consumption

## Observações importantes
- **Order** ainda é a entidade “pedido” única (não separa compra vs venda) e está mapeada para a tabela **`Event`** (migração antiga de “Eventos”).
- Não existe ainda:
  - Pedido de Venda vs Venda vs Entrega (documentos separados)
  - Recebível real por expedição
  - Pagamento antecipado vinculado ao PV
  - Conciliação (aplicação) entre pagamentos e recebíveis
  - Devolução/estorno
