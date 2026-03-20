import { PrismaClient } from '@prisma/client'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env.development.local', override: true })
loadEnv({ path: '.env', override: false })

const prisma = new PrismaClient()
const wsId = process.argv[2]
if (!wsId) {
  console.error('usage: node scripts/po-payable-check.mjs <workspaceId>')
  process.exit(1)
}

async function main() {
  const confirmedPOs = await prisma.purchaseOrder.count({ where: { workspaceId: wsId, status: 'CONFIRMED' } })
  const payablesForPO = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS c
    FROM "FinancialEntry"
    WHERE "workspaceId" = ${wsId}
      AND "type" = 'OUT'
      AND "status" = 'PLANNED'
      AND "purchaseOrderId" IS NOT NULL
  `

  console.log({ confirmedPOs, payablesForPO: payablesForPO?.[0]?.c ?? null })
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
