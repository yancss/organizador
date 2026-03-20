import { PrismaClient } from '@prisma/client'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env.development.local', override: true })
loadEnv({ path: '.env', override: false })

const prisma = new PrismaClient()

const wsId = process.argv[2]
if (!wsId) {
  console.error('usage: node scripts/quick-counts.mjs <workspaceId>')
  process.exit(1)
}

async function main() {
  const payables = await prisma.financialEntry.count({ where: { workspaceId: wsId, type: 'OUT', status: 'PLANNED' } })
  const receivablesOpen = await prisma.receivable.count({ where: { workspaceId: wsId, status: 'OPEN' } })
  const receivablesPaid = await prisma.receivable.count({ where: { workspaceId: wsId, status: 'PAID' } })
  const payments = await prisma.payment.count({ where: { workspaceId: wsId } })
  const paymentsApplied = await prisma.paymentApplication.count({ where: { workspaceId: wsId } })

  console.log({ payables, receivablesOpen, receivablesPaid, payments, paymentsApplied })
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
