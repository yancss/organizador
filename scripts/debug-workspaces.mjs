import { PrismaClient } from '@prisma/client'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env.development.local', override: true })
loadEnv({ path: '.env', override: false })

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true, createdAt: true },
  })
  const workspaces = await prisma.workspace.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, createdAt: true, members: { select: { role: true, user: { select: { email: true } } } } },
  })

  console.log('DATABASE_URL=', (process.env.DATABASE_URL || '').replace(/:\/\/[^:]+:[^@]+@/, '://***:***@'))
  console.log('users:', users.map((u) => ({ id: u.id, email: u.email, createdAt: u.createdAt.toISOString() })))
  console.log(
    'workspaces:',
    workspaces.map((w) => ({
      id: w.id,
      name: w.name,
      createdAt: w.createdAt.toISOString(),
      members: w.members.map((m) => ({ role: m.role, email: m.user.email })),
    })),
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
