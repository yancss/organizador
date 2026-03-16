import type { WorkspaceContext } from '@/lib/authz'

export type PermissionKey = string

export function hasPermission(ctx: WorkspaceContext, perm: PermissionKey) {
  // SUPERADMIN bypass
  if (ctx.isSuperadmin) return true
  // Workspace ADMIN bypass
  if (ctx.workspaceRole === 'ADMIN') return true

  const perms = new Set((ctx as any).permissions as string[] | undefined)
  return perms.has(perm)
}
