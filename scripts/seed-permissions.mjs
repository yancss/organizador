import { PrismaClient } from '@prisma/client'
import { config as loadEnv } from 'dotenv'

// Prefer local dev env first. override=true to avoid seeding the wrong DB.
loadEnv({ path: '.env.development.local', override: true })
loadEnv({ path: '.env.local', override: false })
loadEnv({ path: '.env', override: false })

const prisma = new PrismaClient()

const PERMS = [
  // Sales
  { key: 'sales.view', module: 'sales', action: 'view', description: 'Pedidos de venda, entregas e agenda comercial' },
  { key: 'sales.edit', module: 'sales', action: 'edit', description: 'Criar, editar e movimentar pedidos de venda e entregas' },

  // Purchases
  { key: 'purchases.view', module: 'purchases', action: 'view', description: 'Pedidos de compra e acompanhamento de recebimento' },
  { key: 'purchases.edit', module: 'purchases', action: 'edit', description: 'Criar, editar e receber pedidos de compra' },

  // Inventory
  { key: 'inventory.view', module: 'inventory', action: 'view', description: 'Estoque, locais, transferencias e reposicao' },
  { key: 'inventory.edit', module: 'inventory', action: 'edit', description: 'Ajustar estoque, locais, transferencias e producao' },

  // Products
  { key: 'products.view', module: 'products', action: 'view', description: 'Produtos, codigos de barras e receitas' },
  { key: 'products.edit', module: 'products', action: 'edit', description: 'Criar, editar e manter produtos, codigos e receitas' },

  // Clients
  { key: 'clients.view', module: 'clients', action: 'view', description: 'Clientes, fornecedores e dados cadastrais' },
  { key: 'clients.edit', module: 'clients', action: 'edit', description: 'Criar, editar e inativar clientes e fornecedores' },

  // Finance
  { key: 'finance.view', module: 'finance', action: 'view', description: 'Lancamentos, contas, categorias, recebiveis, pagaveis e custos' },
  { key: 'finance.edit', module: 'finance', action: 'edit', description: 'Criar, editar e baixar rotinas financeiras' },

  // Workflow
  { key: 'workflow.view', module: 'workflow', action: 'view', description: 'Fila de aprovacoes e decisoes pendentes' },
  { key: 'workflow.edit', module: 'workflow', action: 'edit', description: 'Aprovar ou rejeitar solicitacoes' },
]

const LEGACY_PERMISSION_KEYS = ['admin.security', 'admin.roles']

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
  await prisma.permission.deleteMany({
    where: { key: { in: LEGACY_PERMISSION_KEYS } },
  })
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
