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
  loadEnvFileIfNeeded('.env.development.local', { override: true })
  loadEnvFileIfNeeded('.env.local', { override: true })
  loadEnvFileIfNeeded('.env')

  const prisma = new PrismaClient()

  const rows = await prisma.passwordResetToken.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { email: true, createdAt: true, expiresAt: true, usedAt: true, tokenHash: true },
  })

  console.log('DATABASE_URL:', process.env.DATABASE_URL)
  console.log(
    rows.map((r) => ({
      email: r.email,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
      usedAt: r.usedAt,
      tokenHashPrefix: r.tokenHash.slice(0, 12) + '…',
    }))
  )

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
