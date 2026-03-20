const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

function loadEnvFileIfNeeded(relPath, opts = {}) {
  const p = path.join(__dirname, '..', relPath)
  if (!fs.existsSync(p)) return
  const raw = fs.readFileSync(p, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const m = trimmed.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m) continue
    const key = m[1]
    let val = m[2]
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    const override = Boolean(opts.override)
    if (override && key === 'DATABASE_URL') {
      process.env[key] = val
    } else if (process.env[key] === undefined) {
      process.env[key] = val
    }
  }
}

async function main() {
  // Prefer local dev env if present
  loadEnvFileIfNeeded('.env.development.local', { override: true })
  loadEnvFileIfNeeded('.env')

  const prisma = new PrismaClient()
  const supportEmail = 'support.guardian.app@gmail.com'

  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, active: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  const support = users.find((u) => (u.email || '').toLowerCase() === supportEmail)
  const superadmins = users.filter((u) => u.role === 'SUPERADMIN')

  const workspaces = await prisma.workspace.findMany({
    select: { id: true, name: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  const memberships = await prisma.workspaceMember.findMany({
    select: { id: true, userId: true, workspaceId: true, role: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  console.log('DATABASE_URL:', process.env.DATABASE_URL ? '(set)' : '(missing)')
  console.log('Users:', users.length)
  console.log('Superadmins:', superadmins.map((u) => ({ id: u.id, email: u.email, role: u.role })))
  console.log('Support:', support ? { id: support.id, email: support.email, role: support.role, active: support.active } : null)
  console.log('Workspaces:', workspaces)
  console.log('WorkspaceMembers:', memberships)
  if (support) {
    console.log('Support memberships:', memberships.filter((m) => m.userId === support.id))
  }

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
