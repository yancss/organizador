import { PrismaClient } from '@prisma/client'
import { config as loadEnv } from 'dotenv'

// Load local dev env first, then fallback to .env
// NOTE: override=true so an old terminal/session DATABASE_URL doesn't accidentally point to cloud.
loadEnv({ path: '.env.development.local', override: true })
loadEnv({ path: '.env', override: false })

const prisma = new PrismaClient()

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function rnd(min, max) {
  return min + Math.random() * (max - min)
}

function daysFromNow(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d
}

async function main() {
  const stamp = new Date().toISOString().slice(0, 10)
  const wsName = `Seed Workspace ${stamp}`

  const dbUrl = process.env.DATABASE_URL || ''
  const allowCloud = process.env.ALLOW_CLOUD_SEED === '1'
  const looksCloud = /neon\.tech|render\.com|supabase\.com|amazonaws\.com/i.test(dbUrl)
  if (looksCloud && !allowCloud) {
    console.error('[seed] Refusing to seed what looks like a cloud database. Set ALLOW_CLOUD_SEED=1 to override.')
    console.error('[seed] DATABASE_URL:', dbUrl.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@'))
    process.exit(1)
  }

  console.log('[seed] start', { wsName })

  // Seed into the Support user's first workspace so the UI shows the data.
  // SUPERADMIN is enforced at DB-level for support.guardian.app@gmail.com.
  const supportEmail = 'support.guardian.app@gmail.com'

  const u1 = await prisma.user.upsert({
    where: { email: supportEmail },
    update: { active: true, role: 'SUPERADMIN' },
    create: {
      email: supportEmail,
      name: 'Support Guardian',
      active: true,
      role: 'SUPERADMIN',
    },
    select: { id: true, email: true },
  })

  const workspaceId = (
    await prisma.workspaceMember.findFirst({
      where: { userId: u1.id },
      orderBy: { createdAt: 'asc' },
      select: { workspaceId: true },
    })
  )?.workspaceId

  const ws = workspaceId
    ? await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true, name: true } })
    : null

  const wsFinal =
    ws ??
    (await prisma.workspace.create({
      data: {
        name: 'Meu espaço',
        members: { create: [{ userId: u1.id, role: 'ADMIN' }] },
      },
      select: { id: true, name: true },
    }))

  // Ensure membership is ADMIN
  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: wsFinal.id, userId: u1.id } },
    update: { role: 'ADMIN' },
    create: { workspaceId: wsFinal.id, userId: u1.id, role: 'ADMIN' },
    select: { id: true },
  })

  const wsTarget = wsFinal

  console.log('[seed] workspace', wsTarget)

  // Finance setup
  const accountCash = await prisma.financialAccount.create({
    data: { workspaceId: wsTarget.id, name: 'Caixa', kind: 'CASH', openingBalance: 1000 },
    select: { id: true },
  })

  const catSales = await prisma.financialCategory.create({
    data: { workspaceId: wsTarget.id, name: 'Vendas', type: 'IN' },
    select: { id: true },
  })
  const catPurch = await prisma.financialCategory.create({
    data: { workspaceId: wsTarget.id, name: 'Compras', type: 'OUT' },
    select: { id: true },
  })

  // Clients (customers + suppliers)
  const customers = []
  const suppliers = []
  for (let i = 1; i <= 30; i++) {
    customers.push(
      await prisma.client.create({
        data: {
          workspaceId: wsTarget.id,
          name: `Cliente ${i}`,
          roles: ['CUSTOMER'],
          phone: `+351910000${String(i).padStart(3, '0')}`,
          phoneCountry: 'PT',
        },
        select: { id: true, name: true },
      }),
    )
  }
  for (let i = 1; i <= 15; i++) {
    suppliers.push(
      await prisma.client.create({
        data: {
          workspaceId: wsTarget.id,
          name: `Fornecedor ${i}`,
          roles: ['SUPPLIER'],
          phone: `+351920000${String(i).padStart(3, '0')}`,
          phoneCountry: 'PT',
        },
        select: { id: true, name: true },
      }),
    )
  }

  console.log('[seed] clients', { customers: customers.length, suppliers: suppliers.length })

  // Products
  const rawNames = ['Farinha', 'Açúcar', 'Ovos', 'Leite', 'Chocolate', 'Manteiga', 'Fermento', 'Sal', 'Baunilha', 'Óleo']
  const finishedNames = ['Bolo Chocolate', 'Bolo Baunilha', 'Pão Caseiro', 'Brownie', 'Torta Maçã']

  const rawProducts = []
  for (let i = 0; i < rawNames.length; i++) {
    rawProducts.push(
      await prisma.product.create({
        data: {
          workspaceId: wsTarget.id,
          name: rawNames[i],
          kind: 'RAW',
          unit: 'kg',
          active: true,
          inventory: { create: { workspaceId: wsTarget.id, quantity: 500 } },
        },
        select: { id: true, name: true, unit: true, kind: true },
      }),
    )
  }

  const finishedProducts = []
  for (let i = 0; i < finishedNames.length; i++) {
    finishedProducts.push(
      await prisma.product.create({
        data: {
          workspaceId: wsTarget.id,
          name: finishedNames[i],
          kind: 'FINISHED',
          unit: 'un',
          active: true,
          inventory: { create: { workspaceId: wsTarget.id, quantity: 200 } },
        },
        select: { id: true, name: true, unit: true, kind: true },
      }),
    )
  }

  console.log('[seed] products', { raw: rawProducts.length, finished: finishedProducts.length })

  // Recipes (each finished product uses a few raw)
  const recipes = []
  for (const fp of finishedProducts) {
    const ins = new Set()
    while (ins.size < 3) ins.add(pick(rawProducts).id)
    const items = [...ins].map((pid) => ({ productId: pid, quantity: Number(rnd(0.5, 3).toFixed(3)) }))

    const r = await prisma.recipe.create({
      data: {
        workspaceId: wsTarget.id,
        productId: fp.id,
        yieldQty: 10,
        observations: `Receita base de ${fp.name}`,
        items: { create: items },
      },
      select: { id: true, productId: true },
    })
    recipes.push(r)
  }

  console.log('[seed] recipes', { recipes: recipes.length })

  // Purchase Orders (for pagination)
  const purchaseOrders = []
  for (let i = 1; i <= 80; i++) {
    if (i % 20 === 0) console.log('[seed] purchaseOrders', i)
    const supplier = pick(suppliers)
    const status = i % 3 === 0 ? 'CONFIRMED' : i % 7 === 0 ? 'CANCELLED' : 'DRAFT'

    const ins = new Set()
    while (ins.size < 3) ins.add(pick(rawProducts).id)
    const items = [...ins].map((pid) => ({ productId: pid, quantity: Number(rnd(1, 20).toFixed(3)) }))

    const po = await prisma.purchaseOrder.create({
      data: {
        workspaceId: wsTarget.id,
        supplierId: supplier.id,
        supplier: null,
        orderedAt: daysFromNow(-i),
        status,
        estimatedCost: Number(rnd(50, 800).toFixed(2)),
        observations: `PO #${i} (${status})`,
        items: { create: items },
      },
      select: { id: true, status: true, items: { select: { productId: true, quantity: true } } },
    })
    purchaseOrders.push(po)

    // If confirmed, reflect stock entry and create payable commitment
    // (seed uses prisma directly, bypassing the API hooks)
    if (status === 'CONFIRMED') {
      for (const it of po.items) {
        await prisma.inventory.update({ where: { productId: it.productId }, data: { quantity: { increment: it.quantity } } })
      }

      await prisma.financialEntry.create({
        data: {
          workspaceId: wsTarget.id,
          competenceDate: daysFromNow(-i),
          type: 'OUT',
          status: 'PLANNED',
          paidAt: null,
          accountId: accountCash.id,
          categoryId: catPurch.id,
          costCenterId: null,
          value: Number(rnd(50, 800).toFixed(2)),
          purchaseOrderId: po.id,
          observations: 'Compromisso por PO confirmada (seed)',
        },
        select: { id: true },
      })
    }
  }

  // Sales Orders + Deliveries + Receivables + Payments
  for (let i = 1; i <= 120; i++) {
    if (i % 30 === 0) console.log('[seed] salesOrders', i)
    const customer = pick(customers)
    const deliveryAt = daysFromNow(Math.floor(rnd(-30, 30)))
    const statuses = ['DRAFT', 'CONFIRMED', 'IN_PRODUCTION', 'READY', 'SHIPPED', 'DONE']
    const status = pick(statuses)

    const itemsCount = 1 + Math.floor(Math.random() * 3)
    const picked = new Set()
    while (picked.size < itemsCount) picked.add(pick(finishedProducts).id)

    const so = await prisma.salesOrder.create({
      data: {
        workspaceId: wsTarget.id,
        ownerId: u1.id,
        clientId: customer.id,
        name: `PV ${String(i).padStart(4, '0')}`,
        orderedAt: daysFromNow(-Math.floor(rnd(0, 45))),
        deliveryAt,
        status,
        value: Number(rnd(100, 2000).toFixed(2)),
        orderIndex: String(Date.now() - i * 1000),
        items: {
          create: [...picked].map((pid) => ({ productId: pid, quantity: Number(rnd(1, 15).toFixed(3)) })),
        },
      },
      select: { id: true, clientId: true, value: true, items: { select: { productId: true, quantity: true } } },
    })

    // Create delivery for ~70% orders
    if (Math.random() < 0.7) {
      const delStatus = Math.random() < 0.6 ? 'SHIPPED' : 'PLANNED'
      const delivery = await prisma.delivery.create({
        data: {
          workspaceId: wsTarget.id,
          salesOrderId: so.id,
          clientId: so.clientId,
          status: delStatus,
          plannedAt: deliveryAt,
          shippedAt: delStatus === 'SHIPPED' ? daysFromNow(-Math.floor(rnd(0, 5))) : null,
          value: so.value,
          items: { create: so.items.map((it) => ({ productId: it.productId, quantity: it.quantity })) },
        },
        select: { id: true, status: true, items: { select: { productId: true, quantity: true } } },
      })

      if (delStatus === 'SHIPPED') {
        // Decrement finished stock
        for (const it of delivery.items) {
          await prisma.inventory.update({ where: { productId: it.productId }, data: { quantity: { decrement: it.quantity } } })
        }

        const receivable = await prisma.receivable.create({
          data: {
            workspaceId: wsTarget.id,
            salesOrderId: so.id,
            deliveryId: delivery.id,
            clientId: so.clientId,
            value: so.value ?? 0,
            issuedAt: new Date(),
            // Some overdue, some future
            dueAt: Math.random() < 0.3 ? daysFromNow(-Math.floor(rnd(1, 20))) : daysFromNow(Math.floor(rnd(5, 25))),
            // Keep many OPEN so you can test pending lists
            status: Math.random() < 0.1 ? 'PAID' : 'OPEN',
          },
          select: { id: true, status: true, value: true },
        })

        // Create payments:
        // - some applied partially
        // - some unapplied (to test Payments list / future application logic)
        if (Math.random() < 0.65) {
          const payValue = Number((Number(receivable.value) * rnd(0.1, 0.8)).toFixed(2))
          const payment = await prisma.payment.create({
            data: {
              workspaceId: wsTarget.id,
              salesOrderId: so.id,
              clientId: so.clientId,
              method: pick(['CASH', 'TRANSFER', 'MBWAY', 'PIX', 'CARD']),
              status: 'RECEIVED',
              receivedAt: new Date(),
              value: payValue,
              reference: `REF-${so.id.slice(0, 6)}-${i}`,
            },
            select: { id: true, value: true },
          })

          if (Math.random() < 0.7) {
            await prisma.paymentApplication.create({
              data: {
                workspaceId: wsTarget.id,
                paymentId: payment.id,
                receivableId: receivable.id,
                value: payValue,
                appliedAt: new Date(),
              },
              select: { id: true },
            })
          }
        }

        // Financial entry IN: some PAID, some PLANNED (to test filters)
        const plannedIn = Math.random() < 0.25
        await prisma.financialEntry.create({
          data: {
            workspaceId: wsTarget.id,
            competenceDate: new Date(),
            type: 'IN',
            status: plannedIn ? 'PLANNED' : 'PAID',
            paidAt: plannedIn ? null : new Date(),
            accountId: accountCash.id,
            categoryId: catSales.id,
            value: so.value ?? 0,
            salesOrderId: so.id,
            observations: plannedIn ? 'Entrada planejada (seed)' : 'Entrada por venda (seed)',
          },
          select: { id: true },
        })
      }
    }
  }

  // Some purchases + financial OUT entries
  for (let i = 1; i <= 160; i++) {
    if (i % 40 === 0) console.log('[seed] purchases', i)
    const p = pick(rawProducts)
    const pur = await prisma.purchase.create({
      data: {
        workspaceId: wsTarget.id,
        productId: p.id,
        date: daysFromNow(-Math.floor(rnd(0, 60))),
        quantity: Number(rnd(1, 50).toFixed(3)),
        cost: Number(rnd(10, 400).toFixed(2)),
        supplier: pick(suppliers).name,
        observations: 'Compra avulsa (seed)',
      },
      select: { id: true, cost: true },
    })

    const plannedOut = Math.random() < 0.35
    await prisma.financialEntry.create({
      data: {
        workspaceId: wsTarget.id,
        competenceDate: daysFromNow(-Math.floor(rnd(0, 25))),
        type: 'OUT',
        status: plannedOut ? 'PLANNED' : 'PAID',
        paidAt: plannedOut ? null : new Date(),
        accountId: accountCash.id,
        categoryId: catPurch.id,
        value: pur.cost ?? 0,
        purchaseId: pur.id,
        observations: plannedOut ? 'Compra planejada (seed)' : 'Saída por compra (seed)',
      },
      select: { id: true },
    })
  }

  console.log('Seed completed')
  console.log('Workspace:', ws)
  console.log('Users:', u1.email)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

