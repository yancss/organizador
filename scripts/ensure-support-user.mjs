import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const email = (process.env.SUPPORT_GUARDIAN_EMAIL || 'support.guardian.app@gmail.com').trim().toLowerCase()

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: 'Support',
      role: 'SUPERADMIN',
      active: true,
    },
    update: {
      active: true,
      role: 'SUPERADMIN',
      name: 'Support',
    },
    select: { id: true, email: true },
  })

  // Ensure there is a workspace to attach membership to
  let ws = null
  const wsId = process.env.WORKSPACE_ID
  if (wsId) {
    ws = await prisma.workspace.findUnique({ where: { id: wsId }, select: { id: true, name: true } })
    if (!ws) throw new Error(`WORKSPACE_ID not found: ${wsId}`)
  } else {
    ws = await prisma.workspace.findFirst({ select: { id: true, name: true }, orderBy: { createdAt: 'asc' } })
  }

  if (!ws) {
    ws = await prisma.workspace.create({
      data: {
        name: '[DEFAULT] Workspace',
        createdById: user.id,
        updatedById: user.id,
      },
      select: { id: true, name: true },
    })
  }

  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: ws.id, userId: user.id } },
    create: { workspaceId: ws.id, userId: user.id, role: 'ADMIN', createdById: user.id },
    update: { role: 'ADMIN' },
    select: { id: true },
  })

  console.log(`[ensure-support-user] ok user=${user.email} id=${user.id} workspace=${ws.name} (${ws.id})`)
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error('[ensure-support-user] failed', e)
    await prisma.$disconnect()
    process.exit(1)
  })
