import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/authz'
import { sendEmail } from '@/lib/email'
import { newResetToken, sha256 } from '@/lib/tokens'

const BodySchema = z.object({
  email: z.string().email(),
  name: z.string().max(140).optional().nullable(),
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
  const name = parsed.data.name?.trim() || null
  const workspaceRole = parsed.data.role

  // 1) Upsert user (no password yet)
  const user = await prisma.user.upsert({
    where: { email },
    update: { name: name ?? undefined, active: true },
    create: {
      email,
      name,
      active: true,
      role: 'USER',
      passwordHash: null,
    },
    select: { id: true, email: true, name: true, active: true },
  })

  // 2) Ensure membership in workspace
  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
    update: { role: workspaceRole },
    create: { workspaceId, userId: user.id, role: workspaceRole },
    select: { id: true },
  })

  // 3) Create invite token
  const token = newResetToken()
  const tokenHash = sha256(token)
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24) // 24h

  await prisma.userInviteToken.create({
    data: {
      email,
      tokenHash,
      expiresAt,
      workspaceId,
      createdById: inviter.id,
    },
    select: { id: true },
  })

  const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const activateUrl = `${appUrl.replace(/\/$/, '')}/activate?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`

  // 4) Send invite email
  try {
    await sendEmail({
      to: email,
      subject: 'Guardian — Convite para acesso',
      text: `Você foi convidado para acessar a plataforma Guardian.\n\nFinalize seu cadastro e defina sua senha (válido por 24 horas):\n${activateUrl}`,
      html: `<p>Você foi convidado para acessar a plataforma Guardian.</p><p><a href="${activateUrl}">Clique aqui para finalizar o cadastro e definir sua senha</a> (válido por 24 horas).</p>`,
    })
  } catch (err) {
    console.error('[admin/invites] sendEmail failed', err)
    if (process.env.NODE_ENV !== 'production') {
      console.log('[admin/invites] dev activateUrl', activateUrl)
    }
  }

  // 5) Notify superadmin (support)
  const supportEmail = (process.env.SUPPORT_GUARDIAN_EMAIL || 'support.guardian.app@gmail.com').trim().toLowerCase()
  if (supportEmail && supportEmail !== email) {
    try {
      const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } })
      await sendEmail({
        to: supportEmail,
        subject: 'Guardian — usuário vinculado a workspace',
        text: `Usuário ${email} foi vinculado ao workspace ${ws?.name ?? workspaceId} por ${inviter.id}.`,
      })
    } catch (err) {
      console.error('[admin/invites] notify support failed', err)
    }
  }

  return Response.json({ ok: true }, { status: 201 })
}
