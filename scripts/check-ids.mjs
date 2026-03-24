import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function assertFmt(id, prefix) {
  if (!id) return false
  if (prefix) {
    const re = new RegExp('^' + prefix + '\\d{10}$')
    return re.test(id)
  }
  return /^[A-Z]{2,3}\d{10}$/.test(id)
}

async function main() {
  const ws = await prisma.workspace.findFirst({ select: { id: true, name: true } })
  const u = await prisma.user.findFirst({ select: { id: true, email: true } })
  const so = await prisma.salesOrder.findFirst({ select: { id: true } })
  const di = await prisma.deliveryItem.findFirst({ select: { id: true } })
  const pap = await prisma.paymentApplication.findFirst({ select: { id: true } })

  console.log('Samples:')
  console.log({ workspace: ws, user: u, salesOrder: so, deliveryItem: di, paymentApplication: pap })

  console.log('\nFormat checks:')
  console.log({
    workspace: assertFmt(ws?.id, 'WS'),
    user: assertFmt(u?.id, 'US'),
    salesOrder: assertFmt(so?.id, 'SO'),
    deliveryItem: assertFmt(di?.id, 'DI'),
    paymentApplication: assertFmt(pap?.id, 'PAP'),
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
