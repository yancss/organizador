import { PrismaClient } from '@prisma/client'
import { config as loadEnv } from 'dotenv'
import bcrypt from 'bcryptjs'

// Load local dev env first, then fallback to .env
loadEnv({ path: '.env.development.local', override: true })
loadEnv({ path: '.env', override: false })

const prisma = new PrismaClient()

async function main() {
  const email = (process.env.SUPPORT_GUARDIAN_EMAIL || 'support.guardian.app@gmail.com').trim().toLowerCase()
  const password = process.env.SUPPORT_GUARDIAN_PASSWORD || 'ChangeMe123!'

  // Refuse to run on cloud unless explicitly allowed
  const dbUrl = process.env.DATABASE_URL || ''
  const allowCloud = process.env.ALLOW_CLOUD_BOOTSTRAP === '1'
  const looksCloud = /neon\.tech|render\.com|supabase\.com|amazonaws\.com/i.test(dbUrl)
  if (looksCloud && !allowCloud) {
    console.error('[bootstrap-superadmin] Refusing to run on what looks like a cloud DB. Set ALLOW_CLOUD_BOOTSTRAP=1 to override.')
    console.error('[bootstrap-superadmin] DATABASE_URL:', dbUrl.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@'))
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(password, 10)

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      role: 'SUPERADMIN',
      active: true,
      passwordHash,
    },
    create: {
      email,
      name: 'Support Guardian',
      active: true,
      role: 'SUPERADMIN',
      passwordHash,
    },
    select: { id: true, email: true, role: true },
  })

  // Ensure there is at least one workspace and that Support is a member (ADMIN)
  let ws = await prisma.workspace.findFirst({ select: { id: true, name: true } })
  if (!ws) {
    ws = await prisma.workspace.create({
      data: { name: 'Meu espaço', members: { create: { userId: user.id, role: 'ADMIN' } } },
      select: { id: true, name: true },
    })
  } else {
    await prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: ws.id, userId: user.id } },
      update: { role: 'ADMIN' },
      create: { workspaceId: ws.id, userId: user.id, role: 'ADMIN' },
      select: { id: true },
    })
  }

  console.log('[bootstrap-superadmin] ok')
  console.log('  email:', user.email)
  console.log('  role:', user.role)
  console.log('  ensured membership in workspace:', ws.id, ws.name)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
