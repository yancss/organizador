import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { newResetToken, sha256 } from '@/lib/tokens'

const BodySchema = z.object({
  email: z.string().email(),
})

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)

  // Não revelar se existe ou não (anti-enumeração)
  if (!parsed.success) {
    return Response.json({ ok: true }, { status: 200 })
  }

  const email = parsed.data.email.trim().toLowerCase()

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, active: true, email: true },
  })

  // Sempre responder ok, mesmo se usuário não existir/inativo
  if (!user || user.active === false || !user.email) {
    return Response.json({ ok: true }, { status: 200 })
  }

  const token = newResetToken()
  const tokenHash = sha256(token)
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30) // 30 min

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
    await sendEmail({
      to: email,
      subject: 'Guardian — Recuperação de senha',
      text: `Você solicitou a recuperação de senha.\n\nAbra este link para definir uma nova senha (válido por 30 minutos):\n${resetUrl}\n\nSe você não solicitou, ignore este email.`,
      html: `
        <p>Você solicitou a recuperação de senha.</p>
        <p><a href="${resetUrl}">Clique aqui para definir uma nova senha</a> (válido por 30 minutos).</p>
        <p>Se você não solicitou, ignore este email.</p>
      `,
    })
  } catch (err) {
    // Não derrubar o fluxo para o usuário (pode ser SMTP mal configurado).
    // Logar para debug.
    console.error('[forgot-password] sendEmail failed', err)
  }

  return Response.json({ ok: true }, { status: 200 })
}
