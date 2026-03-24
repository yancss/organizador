import { PrismaClient } from '@prisma/client'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env.development.local', override: true })
loadEnv({ path: '.env', override: false })

const prisma = new PrismaClient()

async function main() {
  const ws = await prisma.workspace.findFirst({ select: { id: true, name: true } })
  console.log('ws', ws)
  if (!ws) return

  const last = await prisma.auditEvent.findMany({
    where: { workspaceId: ws.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, createdAt: true, summary: true, actorUserId: true, entityType: true, entityId: true, changes: true },
  })

  console.log('last audit events:', last)

  const count = await prisma.auditEvent.count({ where: { workspaceId: ws.id } })
  console.log('count', count)
}

main().catch((e)=>{console.error(e); process.exitCode=1}).finally(()=>prisma.$disconnect())
