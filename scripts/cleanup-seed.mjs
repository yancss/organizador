import { PrismaClient } from '@prisma/client'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env.development.local', override: true })
loadEnv({ path: '.env', override: false })

const prisma = new PrismaClient()

const wsId = process.argv[2] || 'cmmnerxkg0002vrxswh6sr9fq'

const dbUrl = process.env.DATABASE_URL || ''
const allowCloud = process.env.ALLOW_CLOUD_CLEANUP === '1'
const looksCloud = /neon\.tech|render\.com|supabase\.com|amazonaws\.com/i.test(dbUrl)
if (looksCloud && !allowCloud) {
  console.error('[cleanup] Refusing to cleanup what looks like a cloud database. Set ALLOW_CLOUD_CLEANUP=1 to override.')
  console.error('[cleanup] DATABASE_URL:', dbUrl.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@'))
  process.exit(1)
}

const emails = [
  'seed.owner.2026-03-12@guardian.local',
  'seed.user.2026-03-12@guardian.local',
]

async function main() {
  const ws = await prisma.workspace.findUnique({ where: { id: wsId }, select: { id: true, name: true } })
  if (!ws) {
    console.log('[cleanup] workspace not found', wsId)
    return
  }

  console.log('[cleanup] deleting workspace data', ws)

  await prisma.$transaction(async (tx) => {
    // Finance / sales flow
    await tx.paymentApplication.deleteMany({ where: { workspaceId: wsId } })
    await tx.refund.deleteMany({ where: { workspaceId: wsId } })
    await tx.payment.deleteMany({ where: { workspaceId: wsId } })
    await tx.receivable.deleteMany({ where: { workspaceId: wsId } })

    await tx.deliveryItem.deleteMany({ where: { delivery: { workspaceId: wsId } } })
    await tx.delivery.deleteMany({ where: { workspaceId: wsId } })

    await tx.salesOrderItem.deleteMany({ where: { salesOrder: { workspaceId: wsId } } })
    await tx.salesOrder.deleteMany({ where: { workspaceId: wsId } })

    // Procurement
    await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrder: { workspaceId: wsId } } })
    await tx.purchaseOrder.deleteMany({ where: { workspaceId: wsId } })

    // Production/consumption
    await tx.consumption.deleteMany({ where: { workspaceId: wsId } })
    await tx.recipeItem.deleteMany({ where: { recipe: { workspaceId: wsId } } })
    await tx.recipe.deleteMany({ where: { workspaceId: wsId } })

    // Purchases + finance
    await tx.financialEntry.deleteMany({ where: { workspaceId: wsId } })
    await tx.purchase.deleteMany({ where: { workspaceId: wsId } })

    await tx.costCenter.deleteMany({ where: { workspaceId: wsId } })
    await tx.financialCategory.deleteMany({ where: { workspaceId: wsId } })
    await tx.financialAccount.deleteMany({ where: { workspaceId: wsId } })

    // Catalog
    await tx.inventory.deleteMany({ where: { workspaceId: wsId } })
    await tx.product.deleteMany({ where: { workspaceId: wsId } })
    await tx.client.deleteMany({ where: { workspaceId: wsId } })

    // Workspace
    await tx.workspaceMember.deleteMany({ where: { workspaceId: wsId } })
    await tx.workspace.delete({ where: { id: wsId } })
  })

  console.log('[cleanup] workspace deleted')

  for (const email of emails) {
    const u = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } })
    if (!u) continue

    const memberships = await prisma.workspaceMember.count({ where: { userId: u.id } })
    const orders = await prisma.salesOrder.count({ where: { ownerId: u.id } })
    const sessions = await prisma.session.count({ where: { userId: u.id } })
    const accounts = await prisma.account.count({ where: { userId: u.id } })

    if (memberships === 0 && orders === 0 && sessions === 0 && accounts === 0) {
      await prisma.user.delete({ where: { id: u.id } })
      console.log('[cleanup] deleted user', email)
    } else {
      console.log('[cleanup] kept user (still referenced)', { email, memberships, orders, sessions, accounts })
    }
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
