import { requireAdmin } from '@/lib/authz'
import { enqueueEmail } from '@/lib/email'
import { prisma } from '@/lib/prisma'
import { newResetToken, sha256 } from '@/lib/tokens'

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  const { id: userId } = await ctx.params

  const member = await prisma.workspaceMember.findFirst({ where: { workspaceId: wsId, userId }, select: { id: true } })
  if (!member) return Response.json({ error: 'NOT_IN_WORKSPACE' }, { status: 400 })

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, active: true },
  })

  if (!user || !user.email) return Response.json({ error: 'NO_EMAIL' }, { status: 400 })
  if (user.active === false) return Response.json({ error: 'INACTIVE_USER' }, { status: 400 })

  const email = user.email.trim().toLowerCase()
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

  await enqueueEmail(
    {
      to: email,
      subject: 'Guardian - Redefinicao de senha',
      text: `Um administrador solicitou a redefinicao da sua senha.\n\nAbra este link para definir uma nova senha (valido por 30 minutos):\n${resetUrl}\n`,
      html: `<p>Um administrador solicitou a redefinicao da sua senha.</p><p><a href="${resetUrl}">Clique aqui para definir uma nova senha</a> (valido por 30 minutos).</p>`,
    },
    { kind: 'admin-password-reset', userId, workspaceId: wsId },
  )

  return Response.json({ ok: true })
}
