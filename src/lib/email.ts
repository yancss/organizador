import nodemailer from 'nodemailer'
import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'

type ResendPayload = {
  from: string
  to: string[]
  subject: string
  text: string
  html?: string
}

export type SendEmailArgs = {
  to: string
  subject: string
  text: string
  html?: string
}

type QueueEmailMeta = Prisma.InputJsonValue | undefined

type QueueEmailResult =
  | { ok: true; mode: 'queued' }
  | { ok: true; mode: 'sync-fallback'; provider: 'resend' | 'smtp' | 'dev' }

function getEmailOutboxMaxAttempts() {
  const raw = Number(process.env.EMAIL_OUTBOX_MAX_ATTEMPTS ?? 5)
  if (!Number.isFinite(raw) || raw <= 0) return 5
  return Math.min(10, Math.floor(raw))
}

function getEmailOutboxBatchSize() {
  const raw = Number(process.env.EMAIL_OUTBOX_BATCH_SIZE ?? 20)
  if (!Number.isFinite(raw) || raw <= 0) return 20
  return Math.min(100, Math.floor(raw))
}

function getEmailOutboxBackoffMs(attempt: number) {
  const baseMs = Number(process.env.EMAIL_OUTBOX_RETRY_BASE_MS ?? 30_000)
  const safeBase = Number.isFinite(baseMs) && baseMs > 0 ? baseMs : 30_000
  const exponent = Math.max(0, Math.min(5, attempt - 1))
  return safeBase * Math.pow(2, exponent)
}

function isOutboxUnavailableError(err: unknown) {
  const message = String((err as any)?.message ?? err ?? '')
  const code = String((err as any)?.code ?? '')
  return (
    code === 'P2021' ||
    code === 'P2022' ||
    message.includes('EmailOutbox') ||
    message.includes('does not exist') ||
    message.includes('does not contain')
  )
}

function getResendConfig() {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM
  if (!apiKey || !from) return null
  return { apiKey, from }
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

async function sendViaResend(args: SendEmailArgs) {
  const cfg = getResendConfig()
  if (!cfg) return null

  const payload: ResendPayload = {
    from: cfg.from,
    to: [args.to],
    subject: args.subject,
    text: args.text,
    html: args.html,
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Resend error: ${res.status} ${detail}`)
  }

  return { ok: true as const, provider: 'resend' as const }
}

async function sendViaSmtp(args: SendEmailArgs) {
  const cfg = getSmtpConfig()
  if (!cfg) return null

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: cfg.auth,
  })

  await transporter.sendMail({
    from: cfg.from,
    to: args.to,
    subject: args.subject,
    text: args.text,
    html: args.html,
  })

  return { ok: true as const, provider: 'smtp' as const }
}

export async function sendEmail(args: SendEmailArgs) {
  // Priority: Resend -> SMTP -> dev log
  const viaResend = await sendViaResend(args)
  if (viaResend) return viaResend

  const viaSmtp = await sendViaSmtp(args)
  if (viaSmtp) return viaSmtp

  // Dev fallback: if no provider is configured, just log the email.
  console.log('[email:dev]', { to: args.to, subject: args.subject, text: args.text })
  return { ok: true as const, provider: 'dev' as const }
}

export async function enqueueEmail(args: SendEmailArgs, meta?: QueueEmailMeta): Promise<QueueEmailResult> {
  if (process.env.EMAIL_OUTBOX_FORCE_SYNC === '1') {
    const sent = await sendEmail(args)
    return { ok: true, mode: 'sync-fallback', provider: sent.provider }
  }

  try {
    await prisma.emailOutbox.create({
      data: {
        to: args.to,
        subject: args.subject,
        text: args.text,
        html: args.html,
        ...(meta ? { meta } : {}),
      },
      select: { id: true },
    })

    return { ok: true, mode: 'queued' }
  } catch (err) {
    if (!isOutboxUnavailableError(err)) throw err

    const sent = await sendEmail(args)
    return { ok: true, mode: 'sync-fallback', provider: sent.provider }
  }
}

export async function processEmailOutbox() {
  const now = new Date()
  const staleLockCutoff = new Date(now.getTime() - 1000 * 60 * 5)
  const batchSize = getEmailOutboxBatchSize()
  const maxAttempts = getEmailOutboxMaxAttempts()

  const jobs = await prisma.emailOutbox.findMany({
    where: {
      status: { in: ['PENDING', 'FAILED'] },
      availableAt: { lte: now },
      attempts: { lt: maxAttempts },
      OR: [{ lockedAt: null }, { lockedAt: { lt: staleLockCutoff } }],
    },
    orderBy: [{ availableAt: 'asc' }, { createdAt: 'asc' }],
    take: batchSize,
  })

  const results = {
    scanned: jobs.length,
    claimed: 0,
    sent: 0,
    retried: 0,
    failed: 0,
    skipped: 0,
  }

  for (const job of jobs) {
    const claim = await prisma.emailOutbox.updateMany({
      where: {
        id: job.id,
        status: job.status,
        OR: [{ lockedAt: null }, { lockedAt: { lt: staleLockCutoff } }],
      },
      data: {
        status: 'PROCESSING',
        lockedAt: now,
        lastError: null,
      },
    })

    if (claim.count === 0) {
      results.skipped += 1
      continue
    }

    results.claimed += 1

    try {
      await sendEmail({
        to: job.to,
        subject: job.subject,
        text: job.text,
        html: job.html ?? undefined,
      })

      await prisma.emailOutbox.update({
        where: { id: job.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          lockedAt: null,
          lastError: null,
        },
        select: { id: true },
      })

      results.sent += 1
    } catch (err) {
      const nextAttempts = job.attempts + 1
      const exhausted = nextAttempts >= maxAttempts

      await prisma.emailOutbox.update({
        where: { id: job.id },
        data: {
          status: exhausted ? 'FAILED' : 'PENDING',
          attempts: { increment: 1 },
          lockedAt: null,
          lastError: String((err as any)?.message ?? err ?? 'UNKNOWN_ERROR').slice(0, 2000),
          availableAt: exhausted ? now : new Date(now.getTime() + getEmailOutboxBackoffMs(nextAttempts)),
        },
        select: { id: true },
      })

      if (exhausted) results.failed += 1
      else results.retried += 1
    }
  }

  return results
}
