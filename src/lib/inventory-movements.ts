import { prisma } from '@/lib/prisma'

// Small helper to adjust inventory safely.
// We keep it DB-transaction friendly by accepting a Prisma client/tx.

type Tx = Parameters<typeof prisma.$transaction>[0] extends (tx: infer T) => any ? T : never

export async function adjustInventory(
  tx: Tx,
  args: {
    workspaceId: string
    productId: string
    delta: number
    // If true, prevent inventory from going below zero.
    disallowNegative?: boolean
  },
) {
  const disallowNegative = args.disallowNegative ?? true

  // Validate product belongs to workspace (avoids cross-workspace mistakes)
  const product = await tx.product.findFirst({
    where: { id: args.productId, workspaceId: args.workspaceId, active: true },
    select: { id: true },
  })
  if (!product) throw new Error('INVALID_PRODUCT')

  const inv = await tx.inventory.findUnique({
    where: { productId: args.productId },
    select: { id: true, quantity: true, workspaceId: true },
  })

  if (!inv) {
    if (disallowNegative && args.delta < 0) throw new Error('INSUFFICIENT_STOCK')
    await tx.inventory.create({
      data: {
        workspaceId: args.workspaceId,
        productId: args.productId,
        quantity: 0,
      },
      select: { id: true },
    })
  } else {
    if (inv.workspaceId !== args.workspaceId) throw new Error('INVENTORY_WORKSPACE_MISMATCH')
    if (disallowNegative) {
      const next = Number(inv.quantity) + args.delta
      if (next < 0) throw new Error('INSUFFICIENT_STOCK')
    }
  }

  await tx.inventory.update({
    where: { productId: args.productId },
    data: { quantity: { increment: args.delta } },
  })
}
