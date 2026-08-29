import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/authz'

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  // Only return users that belong to this workspace.
  const users = await prisma.user.findMany({
    where: { memberships: { some: { workspaceId: wsId } } },
    orderBy: [{ createdAt: 'asc' }],
    select: {
      id: true,
      name: true,
      email: true,
      birthDate: true,
      role: true,
      active: true,
      sessionMaxAgeSec: true,
      sessionPolicyVersion: true,
      createdAt: true,
      memberships: {
        where: { workspaceId: wsId },
        select: { role: true },
        take: 1,
      },
      workspaceUserRoles: {
        where: { workspaceId: wsId },
        select: { role: { select: { id: true, name: true } } },
      },
    },
  })

  return Response.json({
    users: users.map((u) => ({
      ...u,
      globalRole: u.role,
      customRole: u.workspaceUserRoles[0]?.role ?? null,
      workspaceRole: u.memberships[0]?.role ?? 'USER',
      memberships: undefined,
      workspaceUserRoles: undefined,
    })),
  })
}
