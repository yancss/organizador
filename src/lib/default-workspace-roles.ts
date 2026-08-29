import type { Prisma, PrismaClient } from '@prisma/client'

export type DefaultWorkspaceRolePreset = {
  name: string
  description: string
  permissionKeys: string[]
}

export const DEFAULT_WORKSPACE_ROLE_PRESETS: DefaultWorkspaceRolePreset[] = [
  {
    name: 'Comercial',
    description: 'Pedidos de venda, entregas e consulta operacional de cadastros.',
    permissionKeys: ['sales.view', 'sales.edit', 'clients.view', 'products.view'],
  },
  {
    name: 'Compras',
    description: 'Pedidos de compra, recebimento e apoio de estoque.',
    permissionKeys: ['purchases.view', 'purchases.edit', 'clients.view', 'products.view', 'inventory.view'],
  },
  {
    name: 'Estoque',
    description: 'Estoque, locais, transferencias, reposicao e producao.',
    permissionKeys: ['inventory.view', 'inventory.edit', 'products.view', 'purchases.view'],
  },
  {
    name: 'Financeiro',
    description: 'Rotinas financeiras, cadastros financeiros e custos.',
    permissionKeys: ['finance.view', 'finance.edit', 'clients.view'],
  },
  {
    name: 'Aprovador',
    description: 'Fila de aprovacoes com contexto comercial e compras.',
    permissionKeys: ['workflow.view', 'workflow.edit', 'sales.view', 'purchases.view'],
  },
  {
    name: 'Operacao',
    description: 'Execucao operacional com produtos, estoque e consulta comercial.',
    permissionKeys: ['products.view', 'products.edit', 'inventory.view', 'inventory.edit', 'sales.view', 'clients.view'],
  },
]

type RoleDbClient = PrismaClient | Prisma.TransactionClient

export async function ensureDefaultWorkspaceRoles(args: {
  db: RoleDbClient
  workspaceId: string
  actorUserId?: string | null
}) {
  const permissionKeys = [...new Set(DEFAULT_WORKSPACE_ROLE_PRESETS.flatMap((preset) => preset.permissionKeys))]
  const permissions = await args.db.permission.findMany({
    where: { key: { in: permissionKeys } },
    select: { id: true, key: true },
  })
  const permissionIdByKey = new Map(permissions.map((permission) => [permission.key, permission.id]))

  for (const preset of DEFAULT_WORKSPACE_ROLE_PRESETS) {
    const role = await args.db.workspaceRoleModel.upsert({
      where: { workspaceId_name: { workspaceId: args.workspaceId, name: preset.name } },
      update: {
        description: preset.description,
        updatedById: args.actorUserId ?? undefined,
      },
      create: {
        workspaceId: args.workspaceId,
        name: preset.name,
        description: preset.description,
        isSystem: false,
        createdById: args.actorUserId ?? undefined,
        updatedById: args.actorUserId ?? undefined,
      },
      select: { id: true },
    })

    const permissionIds = preset.permissionKeys
      .map((key) => permissionIdByKey.get(key))
      .filter((value): value is string => Boolean(value))

    await args.db.workspaceRolePermission.deleteMany({
      where: { workspaceId: args.workspaceId, roleId: role.id },
    })

    if (permissionIds.length > 0) {
      await args.db.workspaceRolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          workspaceId: args.workspaceId,
          roleId: role.id,
          permissionId,
        })),
        skipDuplicates: true,
      })
    }
  }
}
