import { PrismaClient } from '@prisma/client'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env.development.local', override: true })
loadEnv({ path: '.env', override: false })

const prisma = new PrismaClient()

async function main() {
  const ws = await prisma.workspace.findFirst({ select: { id: true, name: true } })
  if (!ws) throw new Error('NO_WORKSPACE')

  const ids = ['SOR0000000078', 'SOR0000000017']

  const orders = await prisma.salesOrder.findMany({
    where: { workspaceId: ws.id, id: { in: ids } },
    select: { id: true, status: true, orderIndex: true, value: true, updatedAt: true, updatedById: true },
  })

  const audit = await prisma.auditEvent.findMany({
    where: { workspaceId: ws.id, entityType: 'SalesOrder', entityId: { in: ids } },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, createdAt: true, summary: true, actorUserId: true, changes: true, meta: true },
  })

  console.log('workspace', ws)
  console.log('orders', orders)
  console.log('audit (last 50)', audit)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
