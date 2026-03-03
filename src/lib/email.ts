import nodemailer from 'nodemailer'

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
