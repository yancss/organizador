/*
  Bootstrap for a fresh company database.

  Guarantees:
  - Support user exists with email support.guardian.app@gmail.com and role SUPERADMIN
  - At least one Workspace exists (creates a default one if missing)
  - Support user is a WorkspaceMember (ADMIN) of the first workspace
  - Sends a password reset link to the support email (so they can set an initial password)

  Usage:
    node scripts/bootstrap-support.js

  Requires:
    DATABASE_URL
    APP_URL or NEXTAUTH_URL (optional; defaults to http://localhost:3000)
    Email provider env (RESEND_* or SMTP_*), if you want the email to actually send.
*/

const { PrismaClient } = require('@prisma/client')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const nodemailer = require('nodemailer')

const SUPPORT_EMAIL = 'support.guardian.app@gmail.com'

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
    // In bootstrapping scripts we prefer values from env files over inherited shell env
    // (especially DATABASE_URL), to avoid writing tokens to the wrong database.
    const override = Boolean(opts.override)
    if (override && key === 'DATABASE_URL') {
      process.env[key] = val
    } else if (process.env[key] === undefined) {
      process.env[key] = val
    }
  }
}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM

  if (!host || !port || !from) return null
  const auth = user && pass ? { user, pass } : undefined
  return { host, port, from, auth }
}

function newResetToken() {
  // 32 bytes -> 43 chars base64url-ish
  return crypto.randomBytes(32).toString('base64url')
}

function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex')
}

async function main() {
  // Load env like Next would (best-effort)
  loadEnvFileIfNeeded('.env.development.local', { override: true })
  loadEnvFileIfNeeded('.env.local', { override: true })
  // Do NOT override DATABASE_URL from .env (lower priority)
  loadEnvFileIfNeeded('.env')

  const prisma = new PrismaClient()

  const appUrl = (process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '')

  // 1) Ensure Support user
  // If a legacy DB already has a SUPERADMIN row with a different email,
  // demote it first to satisfy the "only one SUPERADMIN" constraint.
  const existingSuper = await prisma.user.findFirst({
    where: { role: 'SUPERADMIN' },
    select: { id: true, email: true },
  })

  if (existingSuper && (existingSuper.email || '').toLowerCase() !== SUPPORT_EMAIL) {
    console.warn(
      '[bootstrap] found existing SUPERADMIN with different email; demoting:',
      existingSuper.email ?? '(null)'
    )
    await prisma.user.update({
      where: { id: existingSuper.id },
      data: { role: 'USER' },
      select: { id: true },
    })
  }

  const support = await prisma.user.upsert({
    where: { email: SUPPORT_EMAIL },
    update: { active: true, role: 'SUPERADMIN' },
    create: {
      email: SUPPORT_EMAIL,
      name: 'Support Guardian',
      active: true,
      role: 'SUPERADMIN',
    },
    select: { id: true, email: true },
  })

  // 2) Ensure at least one workspace
  let ws = await prisma.workspace.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } })
  if (!ws) {
    ws = await prisma.workspace.create({
      data: {
        name: 'Matriz',
        createdById: support.id,
        updatedById: support.id,
      },
      select: { id: true },
    })
  }

  // 3) Ensure membership
  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: ws.id, userId: support.id } },
    update: { role: 'ADMIN' },
    create: {
      workspaceId: ws.id,
      userId: support.id,
      role: 'ADMIN',
      createdById: support.id,
      updatedById: support.id,
    },
    select: { id: true },
  })

  // 4) Create reset token + send link
  const token = newResetToken()
  const tokenHash = sha256(token)
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) // 7 days for bootstrap

  // Best-effort: if tokenHash collision (extremely unlikely), regenerate once
  try {
    await prisma.passwordResetToken.create({
      data: {
        email: SUPPORT_EMAIL,
        tokenHash,
        expiresAt,
      },
    })
  } catch (err) {
    const token2 = newResetToken()
    await prisma.passwordResetToken.create({
      data: {
        email: SUPPORT_EMAIL,
        tokenHash: sha256(token2),
        expiresAt,
      },
    })
  }

  const resetUrl = `${appUrl}/reset-password?email=${encodeURIComponent(SUPPORT_EMAIL)}&token=${encodeURIComponent(token)}`

  // Always print the reset link (so you never get stuck).
  console.log('[bootstrap] resetUrl', resetUrl)

  // Send email via SMTP if configured.
  try {
    const smtp = getSmtpConfig()
    if (!smtp) {
      console.warn('[bootstrap] SMTP not configured (set SMTP_HOST/PORT/USER/PASS/FROM). Email not sent.')
    } else {
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.port === 465,
        auth: smtp.auth,
      })

      await transporter.sendMail({
        from: smtp.from,
        to: SUPPORT_EMAIL,
        subject: 'Guardian — Definir senha inicial (bootstrap)',
        text: `Seu banco foi provisionado.\n\nDefina a senha inicial por este link (válido por 7 dias):\n${resetUrl}\n`,
        html: `<p>Seu banco foi provisionado.</p><p><a href="${resetUrl}">Clique aqui para definir a senha inicial</a> (válido por 7 dias).</p>`,
      })

      console.log('[bootstrap] reset email sent to', SUPPORT_EMAIL)
    }
  } catch (err) {
    console.warn('[bootstrap] email send failed:', err?.message ?? err)
  }

  console.log('[bootstrap] done')
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('[bootstrap] failed', err)
  process.exitCode = 1
})
