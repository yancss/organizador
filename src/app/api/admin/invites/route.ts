import { z } from 'zod'

import { requireAdmin } from '@/lib/authz'
import { enqueueEmail } from '@/lib/email'
import { prisma } from '@/lib/prisma'
import { newResetToken, sha256 } from '@/lib/tokens'

const BodySchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'USER']).default('USER'),
})

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  const inviter = auth.user
  const workspaceId = inviter.workspaceId!
  const email = parsed.data.email.trim().toLowerCase()
  const workspaceRole = parsed.data.role

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) {
    return Response.json({ error: 'USER_ALREADY_EXISTS' }, { status: 409 })
  }

  const token = newResetToken()
  const tokenHash = sha256(token)
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24)

  await prisma.userInviteToken.create({
    data: {
      email,
      tokenHash,
      expiresAt,
      workspaceId,
      workspaceRole,
      createdById: inviter.id,
    },
    select: { id: true },
  })

  const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const activateUrl = `${appUrl.replace(/\/$/, '')}/activate?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`

  try {
    await enqueueEmail(
      {
        to: email,
        subject: 'Guardian - Convite para acesso',
        text: `Voce foi convidado para acessar a plataforma Guardian.\n\nFinalize seu cadastro e defina sua senha (valido por 24 horas):\n${activateUrl}`,
        html: `<p>Voce foi convidado para acessar a plataforma Guardian.</p><p><a href="${activateUrl}">Clique aqui para finalizar o cadastro e definir sua senha</a> (valido por 24 horas).</p>`,
      },
      { kind: 'workspace-invite', workspaceId, inviterUserId: inviter.id, workspaceRole },
    )
  } catch (err) {
    console.error('[admin/invites] enqueueEmail failed', err)
    if (process.env.NODE_ENV !== 'production') {
      console.log('[admin/invites] dev activateUrl', activateUrl)
    }
  }

  const supportEmail = (process.env.SUPPORT_GUARDIAN_EMAIL || 'support.guardian.app@gmail.com').trim().toLowerCase()
  if (supportEmail && supportEmail !== email) {
    try {
      const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } })
      await enqueueEmail(
        {
          to: supportEmail,
          subject: 'Guardian - convite enviado',
          text: `Convite enviado para ${email} no workspace ${ws?.name ?? workspaceId} por ${inviter.id} (role: ${workspaceRole}).`,
        },
        { kind: 'support-invite-notification', workspaceId, invitedEmail: email, workspaceRole },
      )
    } catch (err) {
      console.error('[admin/invites] notify support failed', err)
    }
  }

  return Response.json({ ok: true }, { status: 201 })
}
