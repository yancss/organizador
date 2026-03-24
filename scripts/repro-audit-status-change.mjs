import { PrismaClient } from '@prisma/client'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env.development.local', override: true })
loadEnv({ path: '.env', override: false })

const prisma = new PrismaClient()

async function main() {
  const ws = await prisma.workspace.findFirst({ select: { id: true } })
  if (!ws) throw new Error('no workspace')

  const so = await prisma.salesOrder.findFirst({ where: { workspaceId: ws.id }, orderBy: { createdAt: 'asc' }, select: { id: true, status: true, value: true } })
  if (!so) throw new Error('no sales order')

  const nextStatus = so.status === 'DRAFT' ? 'CONFIRMED' : 'DRAFT'

  console.log('Before:', so)

  await prisma.salesOrder.updateMany({ where: { id: so.id, workspaceId: ws.id }, data: { status: nextStatus } })

  const after = await prisma.salesOrder.findFirst({ where: { id: so.id, workspaceId: ws.id }, select: { id: true, status: true, value: true } })
  console.log('After:', after)

  const lastAudit = await prisma.auditEvent.findFirst({
    where: { workspaceId: ws.id, entityType: 'SalesOrder', entityId: so.id },
    orderBy: { createdAt: 'desc' },
    select: { summary: true, createdAt: true, changes: { select: { field: true, from: true, to: true } } },
  })
  console.log('Last audit:', lastAudit)
}

main().catch((e)=>{console.error(e); process.exitCode=1}).finally(()=>prisma.$disconnect())
