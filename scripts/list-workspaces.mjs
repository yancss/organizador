import { PrismaClient } from '@prisma/client'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env.development.local', override: true })
loadEnv({ path: '.env', override: false })

const prisma = new PrismaClient()

async function main() {
  const ws = await prisma.workspace.findMany({ select: { id: true, name: true, createdAt: true }, orderBy: { createdAt: 'asc' } })
  const users = await prisma.user.findMany({ select: { id: true, email: true, createdAt: true }, orderBy: { createdAt: 'asc' } })
  console.log('DATABASE_URL:', (process.env.DATABASE_URL||'').replace(/:\/\/[^:]+:[^@]+@/,'://***:***@'))
  console.log('workspaces:', ws)
  console.log('users:', users)
}

main().finally(()=>prisma.$disconnect())
