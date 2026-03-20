import { PrismaClient } from '@prisma/client'
import { config as loadEnv } from 'dotenv'

// Prefer local dev env first. override=true to avoid seeding the wrong DB.
loadEnv({ path: '.env.development.local', override: true })
loadEnv({ path: '.env.local', override: false })
loadEnv({ path: '.env', override: false })

const prisma = new PrismaClient()

const PERMS = [
  // Sales
  { key: 'sales.view', module: 'sales', action: 'view', description: 'Ver vendas/pedidos de venda' },
  { key: 'sales.edit', module: 'sales', action: 'edit', description: 'Criar/editar vendas/pedidos de venda' },

  // Purchases
  { key: 'purchases.view', module: 'purchases', action: 'view', description: 'Ver compras/pedidos de compra' },
  { key: 'purchases.edit', module: 'purchases', action: 'edit', description: 'Criar/editar compras/pedidos de compra' },

  // Inventory
  { key: 'inventory.view', module: 'inventory', action: 'view', description: 'Ver estoque' },
  { key: 'inventory.edit', module: 'inventory', action: 'edit', description: 'Ajustar/editar estoque' },

  // Products
  { key: 'products.view', module: 'products', action: 'view', description: 'Ver produtos' },
  { key: 'products.edit', module: 'products', action: 'edit', description: 'Criar/editar produtos' },

  // Clients
  { key: 'clients.view', module: 'clients', action: 'view', description: 'Ver clientes/fornecedores' },
  { key: 'clients.edit', module: 'clients', action: 'edit', description: 'Criar/editar clientes/fornecedores' },

  // Finance
  { key: 'finance.view', module: 'finance', action: 'view', description: 'Ver finanças' },
  { key: 'finance.edit', module: 'finance', action: 'edit', description: 'Criar/editar lançamentos financeiros' },

  // Admin
  { key: 'admin.security', module: 'admin', action: 'security', description: 'Acessar painel Admin/Security' },
  { key: 'admin.roles', module: 'admin', action: 'roles', description: 'Gerenciar roles e permissões' },
]

async function main() {
  console.log('[seed-permissions] start')
  for (const p of PERMS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { module: p.module, action: p.action, description: p.description ?? null },
      create: { key: p.key, module: p.module, action: p.action, description: p.description ?? null },
      select: { id: true },
    })
  }
  console.log('[seed-permissions] done', { count: PERMS.length })
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
