import { z } from 'zod'

import { enqueueEmail } from '@/lib/email'
import { prisma } from '@/lib/prisma'
import { newResetToken, sha256 } from '@/lib/tokens'

const BodySchema = z.object({
  email: z.string().email(),
})

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)

  // Nao revelar se existe ou nao (anti-enumeracao)
  if (!parsed.success) {
    return Response.json({ ok: true }, { status: 200 })
  }

  const email = parsed.data.email.trim().toLowerCase()

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, active: true, email: true },
  })

  // Sempre responder ok, mesmo se usuario nao existir/inativo
  if (!user || user.active === false || !user.email) {
    return Response.json({ ok: true }, { status: 200 })
  }

  const token = newResetToken()
  const tokenHash = sha256(token)
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30)

  await prisma.passwordResetToken.create({
    data: {
      email,
      tokenHash,
      expiresAt,
    },
  })

  const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const resetUrl = `${appUrl.replace(/\/$/, '')}/reset-password?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`

  try {
    await enqueueEmail(
      {
        to: email,
        subject: 'Guardian - Recuperacao de senha',
        text: `Voce solicitou a recuperacao de senha.\n\nAbra este link para definir uma nova senha (valido por 30 minutos):\n${resetUrl}\n\nSe voce nao solicitou, ignore este email.`,
        html: `
          <p>Voce solicitou a recuperacao de senha.</p>
          <p><a href="${resetUrl}">Clique aqui para definir uma nova senha</a> (valido por 30 minutos).</p>
          <p>Se voce nao solicitou, ignore este email.</p>
        `,
      },
      { kind: 'forgot-password' },
    )
  } catch (err) {
    console.error('[forgot-password] enqueueEmail failed', err)

    if (process.env.NODE_ENV !== 'production') {
      console.log('[forgot-password] dev resetUrl', resetUrl)
    }
  }

  return Response.json({ ok: true }, { status: 200 })
}
