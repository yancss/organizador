import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { enterWithUser } from '@/lib/request-context'

export type SessionUser = {
  id: string
  role?: 'USER' | 'SUPERADMIN'
  workspaceId?: string
  workspaceRole?: 'USER' | 'ADMIN'
  isSuperadmin?: boolean
  permissions?: string[]
}

export type WorkspaceContext = {
  id: string
  role?: 'USER' | 'SUPERADMIN'
  isSuperadmin?: boolean
  workspaceId: string
  workspaceRole: 'USER' | 'ADMIN'
  permissions?: string[]
}

export async function requireSessionUser() {
  const session = await getServerSession(authOptions)
  const u = session?.user as any as SessionUser | undefined

  if (!u?.id) {
    return { ok: false as const, status: 401, error: 'UNAUTHORIZED' }
  }

  enterWithUser(u.id)

  return { ok: true as const, user: u }
}

export async function requireWorkspace() {
  // Dev bypass (NEVER enable outside development)
  if (process.env.DISABLE_AUTH === '1') {
    if (process.env.NODE_ENV !== 'development') {
      return { ok: false as const, status: 500, error: 'DISABLE_AUTH_NOT_ALLOWED' }
    }
    // Dev bypass: impersonate the Support SUPERADMIN.
    // NOTE: DB-level guardrails enforce that ONLY this email can be SUPERADMIN.
    const email = 'support.guardian.app@gmail.com'

    const user = await prisma.user.upsert({
      where: { email },
      update: { active: true, role: 'SUPERADMIN' },
      create: { email, name: 'Support Guardian', active: true, role: 'SUPERADMIN' },
      select: { id: true, role: true },
    })

    enterWithUser(user.id)

    let m = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      select: { workspaceId: true, role: true },
    })

    // If this is a fresh DB (common in local dev), create a default workspace.
    if (!m) {
      const created = await prisma.$transaction(async (tx) => {
        const ws = await tx.workspace.create({
          data: {
            name: 'Matriz',
            createdById: user.id,
            updatedById: user.id,
          },
          select: { id: true },
        })

        const member = await tx.workspaceMember.create({
          data: {
            workspaceId: ws.id,
            userId: user.id,
            role: 'ADMIN',
            createdById: user.id,
            updatedById: user.id,
          },
          select: { workspaceId: true, role: true },
        })

        return member
      })

      m = created
    }

    return {
      ok: true as const,
      user: {
        id: user.id,
        role: user.role,
        isSuperadmin: true,
        workspaceId: m.workspaceId,
        workspaceRole: m.role,
      },
    }
  }

  const s = await requireSessionUser()
  if (!s.ok) return s

  const u = s.user

  // If session does not have workspace context yet, resolve it from DB.
  let workspaceId = u.workspaceId
  let workspaceRole = u.workspaceRole

  if (!workspaceId || !workspaceRole) {
    const m = await prisma.workspaceMember.findFirst({
      where: { userId: u.id },
      orderBy: { createdAt: 'asc' },
      select: { workspaceId: true, role: true },
    })

    if (!m) return { ok: false as const, status: 403, error: 'NO_WORKSPACE' }

    workspaceId = m.workspaceId
    workspaceRole = m.role
  }

  const isSuper = u.role === 'SUPERADMIN' || u.isSuperadmin === true

  // Resolve permissions (custom roles) for non-admin users.
  let permissions: string[] | undefined = undefined
  if (!isSuper && workspaceRole !== 'ADMIN') {
    if (Array.isArray(u.permissions)) {
      permissions = u.permissions
    } else {
      const rows = await prisma.workspaceUserRole.findMany({
        where: { workspaceId, userId: u.id },
        select: {
          role: {
            select: {
              permissions: {
                select: { permission: { select: { key: true } } },
              },
            },
          },
        },
      })

      const keys = new Set<string>()
      for (const r of rows) {
        for (const rp of r.role.permissions) keys.add(rp.permission.key)
      }
      permissions = [...keys]
    }
  }

  return {
    ok: true as const,
    user: { ...u, workspaceId, workspaceRole, isSuperadmin: isSuper, permissions },
  }
}

export async function requireAdmin() {
  const s = await requireWorkspace()
  if (!s.ok) return s

  const u = s.user

  const isSuper = u.role === 'SUPERADMIN' || u.isSuperadmin === true
  const isAdmin = u.workspaceRole === 'ADMIN'

  if (!isSuper && !isAdmin) {
    return { ok: false as const, status: 403, error: 'FORBIDDEN' }
  }

  return s
}
