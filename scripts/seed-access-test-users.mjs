import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env.development.local', override: true })
loadEnv({ path: '.env.local', override: false })
loadEnv({ path: '.env', override: false })

const prisma = new PrismaClient()

const SUPPORT_EMAIL = (process.env.SUPPORT_GUARDIAN_EMAIL || 'support.guardian.app@gmail.com').trim().toLowerCase()
const DEFAULT_PASSWORD = process.env.TEST_USERS_PASSWORD || 'Guardian123!'

const ROLE_PRESETS = [
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

const TEST_USERS = [
  { name: '[TESTE] Admin Workspace', email: 'admin.workspace.teste@guardian.local', workspaceRole: 'ADMIN', customRole: null },
  { name: '[TESTE] Comercial', email: 'comercial.teste@guardian.local', workspaceRole: 'USER', customRole: 'Comercial' },
  { name: '[TESTE] Compras', email: 'compras.teste@guardian.local', workspaceRole: 'USER', customRole: 'Compras' },
  { name: '[TESTE] Estoque', email: 'estoque.teste@guardian.local', workspaceRole: 'USER', customRole: 'Estoque' },
  { name: '[TESTE] Financeiro', email: 'financeiro.teste@guardian.local', workspaceRole: 'USER', customRole: 'Financeiro' },
  { name: '[TESTE] Aprovador', email: 'aprovador.teste@guardian.local', workspaceRole: 'USER', customRole: 'Aprovador' },
  { name: '[TESTE] Operacao', email: 'operacao.teste@guardian.local', workspaceRole: 'USER', customRole: 'Operacao' },
]

async function ensureSupportWorkspace() {
  const support = await prisma.user.findUnique({
    where: { email: SUPPORT_EMAIL },
    select: { id: true, email: true, role: true },
  })

  if (!support) {
    throw new Error(`Support user not found: ${SUPPORT_EMAIL}`)
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: support.id },
    orderBy: { createdAt: 'asc' },
    select: { workspaceId: true },
  })

  if (!membership) {
    throw new Error(`Support user has no workspace membership: ${SUPPORT_EMAIL}`)
  }

  return { supportUserId: support.id, workspaceId: membership.workspaceId }
}

async function ensurePermissions() {
  const keys = [...new Set(ROLE_PRESETS.flatMap((preset) => preset.permissionKeys))]
  const rows = await prisma.permission.findMany({
    where: { key: { in: keys } },
    select: { id: true, key: true },
  })
  const byKey = new Map(rows.map((row) => [row.key, row.id]))
  const missing = keys.filter((key) => !byKey.has(key))
  if (missing.length) {
    throw new Error(`Missing permission keys: ${missing.join(', ')}. Run npm run seed:permissions first.`)
  }
  return byKey
}

async function upsertRolePreset(workspaceId, supportUserId, permissionIdByKey, preset) {
  const role = await prisma.workspaceRoleModel.upsert({
    where: { workspaceId_name: { workspaceId, name: preset.name } },
    update: {
      description: preset.description,
      updatedById: supportUserId,
    },
    create: {
      workspaceId,
      name: preset.name,
      description: preset.description,
      isSystem: false,
      createdById: supportUserId,
      updatedById: supportUserId,
    },
    select: { id: true, name: true },
  })

  await prisma.workspaceRolePermission.deleteMany({
    where: { workspaceId, roleId: role.id },
  })

  await prisma.workspaceRolePermission.createMany({
    data: preset.permissionKeys.map((key) => ({
      workspaceId,
      roleId: role.id,
      permissionId: permissionIdByKey.get(key),
    })),
    skipDuplicates: true,
  })

  return role
}

async function upsertTestUser(workspaceId, supportUserId, passwordHash, roleByName, spec) {
  const user = await prisma.user.upsert({
    where: { email: spec.email },
    update: {
      name: spec.name,
      active: true,
      passwordHash,
    },
    create: {
      email: spec.email,
      name: spec.name,
      active: true,
      role: 'USER',
      passwordHash,
    },
    select: { id: true, email: true },
  })

  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
    update: { role: spec.workspaceRole, updatedById: supportUserId },
    create: {
      workspaceId,
      userId: user.id,
      role: spec.workspaceRole,
      createdById: supportUserId,
      updatedById: supportUserId,
    },
  })

  if (spec.customRole) {
    const role = roleByName.get(spec.customRole)
    if (!role) throw new Error(`Role preset not found for user ${spec.email}: ${spec.customRole}`)

    await prisma.workspaceUserRole.upsert({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
      update: { roleId: role.id },
      create: {
        workspaceId,
        userId: user.id,
        roleId: role.id,
        createdById: supportUserId,
      },
    })
  } else {
    await prisma.workspaceUserRole.deleteMany({
      where: { workspaceId, userId: user.id },
    })
  }

  return user
}

async function main() {
  if (!DEFAULT_PASSWORD || DEFAULT_PASSWORD.length < 6) {
    throw new Error('TEST_USERS_PASSWORD must be at least 6 chars')
  }

  const { supportUserId, workspaceId } = await ensureSupportWorkspace()
  const permissionIdByKey = await ensurePermissions()
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10)

  const roleByName = new Map()
  for (const preset of ROLE_PRESETS) {
    const role = await upsertRolePreset(workspaceId, supportUserId, permissionIdByKey, preset)
    roleByName.set(role.name, role)
  }

  const createdUsers = []
  for (const spec of TEST_USERS) {
    const user = await upsertTestUser(workspaceId, supportUserId, passwordHash, roleByName, spec)
    createdUsers.push({ email: user.email, workspaceRole: spec.workspaceRole, customRole: spec.customRole })
  }

  console.log('[seed-access-test-users] ok')
  console.table(createdUsers)
  console.log(`[seed-access-test-users] default_password=${DEFAULT_PASSWORD}`)
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error('[seed-access-test-users] failed', e)
    await prisma.$disconnect()
    process.exit(1)
  })
