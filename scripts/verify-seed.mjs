import { PrismaClient } from '@prisma/client'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env.development.local', override: true })
loadEnv({ path: '.env', override: false })

const prisma = new PrismaClient()

const wsId = process.argv[2] || 'cmmnerxkg0002vrxswh6sr9fq'

const dbUrl = process.env.DATABASE_URL || ''
const looksCloud = /neon\.tech|render\.com|supabase\.com|amazonaws\.com/i.test(dbUrl)
console.log('[verify] db', looksCloud ? 'cloud-ish' : 'local-ish')

async function main() {
  const ws = await prisma.workspace.findUnique({ where: { id: wsId }, select: { id: true, name: true, createdAt: true } })
  console.log('[verify] workspace', ws)
  if (!ws) return

  const counts = {
    clients: await prisma.client.count({ where: { workspaceId: wsId } }),
    products: await prisma.product.count({ where: { workspaceId: wsId } }),
    inventories: await prisma.inventory.count({ where: { workspaceId: wsId } }),
    recipes: await prisma.recipe.count({ where: { workspaceId: wsId } }),
    recipeItems: await prisma.recipeItem.count({ where: { recipe: { workspaceId: wsId } } }),
    salesOrders: await prisma.salesOrder.count({ where: { workspaceId: wsId } }),
    purchaseOrders: await prisma.purchaseOrder.count({ where: { workspaceId: wsId } }),
    deliveries: await prisma.delivery.count({ where: { workspaceId: wsId } }),
    receivables: await prisma.receivable.count({ where: { workspaceId: wsId } }),
    payments: await prisma.payment.count({ where: { workspaceId: wsId } }),
    paymentApplications: await prisma.paymentApplication.count({ where: { workspaceId: wsId } }),
    refunds: await prisma.refund.count({ where: { workspaceId: wsId } }),
    financialEntries: await prisma.financialEntry.count({ where: { workspaceId: wsId } }),
    financialAccounts: await prisma.financialAccount.count({ where: { workspaceId: wsId } }),
    financialCategories: await prisma.financialCategory.count({ where: { workspaceId: wsId } }),
    costCenters: await prisma.costCenter.count({ where: { workspaceId: wsId } }),
    purchases: await prisma.purchase.count({ where: { workspaceId: wsId } }),
    consumptions: await prisma.consumption.count({ where: { workspaceId: wsId } }),
  }

  console.log('[verify] counts', counts)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
