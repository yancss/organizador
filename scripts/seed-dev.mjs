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

  // We keep a deterministic workspace name for demos and RESET it on every run,
  // so the visual state reflects the current seed logic (avgCost, production, etc.).
  const wsNameFixed = 'Meu espaço'

  const existing = await prisma.workspace.findFirst({
    where: { name: wsNameFixed, members: { some: { userId: u1.id } } },
    select: { id: true, name: true },
  })

  async function wipeWorkspace(workspaceId) {
    // Delete in dependency order (best-effort, dev-only)
    await prisma.paymentApplication.deleteMany({ where: { workspaceId } }).catch(() => {})
    await prisma.payment.deleteMany({ where: { workspaceId } }).catch(() => {})
    await prisma.receivable.deleteMany({ where: { workspaceId } }).catch(() => {})
    await prisma.refund.deleteMany({ where: { workspaceId } }).catch(() => {})

    await prisma.deliveryItem.deleteMany({ where: { workspaceId } }).catch(() => {})
    await prisma.delivery.deleteMany({ where: { workspaceId } }).catch(() => {})

    await prisma.salesOrderItem.deleteMany({ where: { workspaceId } }).catch(() => {})
    await prisma.salesOrder.deleteMany({ where: { workspaceId } }).catch(() => {})

    await prisma.purchase.deleteMany({ where: { workspaceId } }).catch(() => {})
    await prisma.consumption.deleteMany({ where: { workspaceId } }).catch(() => {})

    await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrder: { workspaceId } } }).catch(() => {})
    await prisma.purchaseOrder.deleteMany({ where: { workspaceId } }).catch(() => {})

    await prisma.recipeItem.deleteMany({ where: { recipe: { workspaceId } } }).catch(() => {})
    await prisma.recipe.deleteMany({ where: { workspaceId } }).catch(() => {})

    await prisma.financialEntry.deleteMany({ where: { workspaceId } }).catch(() => {})

    await prisma.costCenter.deleteMany({ where: { workspaceId } }).catch(() => {})
    await prisma.financialCategory.deleteMany({ where: { workspaceId } }).catch(() => {})
    await prisma.financialAccount.deleteMany({ where: { workspaceId } }).catch(() => {})
    await prisma.workspaceSequence.deleteMany({ where: { workspaceId } }).catch(() => {})

    await prisma.inventory.deleteMany({ where: { workspaceId } }).catch(() => {})

    // These are referenced by recipe items / PO items etc; keep them for last
    await prisma.client.deleteMany({ where: { workspaceId } }).catch(() => {})
    await prisma.product.deleteMany({ where: { workspaceId } }).catch(() => {})
  }

  let wsFinal
  if (existing) {
    console.log('[seed] wiping workspace data', { id: existing.id, name: existing.name })
    await wipeWorkspace(existing.id)
    wsFinal = existing
  } else {
    wsFinal = await prisma.workspace.create({
      data: {
        name: wsNameFixed,
        members: { create: [{ userId: u1.id, role: 'ADMIN' }] },
      },
      select: { id: true, name: true },
    })
  }

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
          inventory: { create: { workspaceId: wsTarget.id, quantity: 0 } },
        },
        select: { id: true, name: true, unit: true, kind: true },
      }),
    )
  }

  const intermediateNames = ['Massa Base', 'Recheio Base', 'Cobertura Base']

  const intermediateProducts = []
  for (let i = 0; i < intermediateNames.length; i++) {
    intermediateProducts.push(
      await prisma.product.create({
        data: {
          workspaceId: wsTarget.id,
          name: intermediateNames[i],
          kind: 'INTERMEDIATE',
          unit: 'un',
          active: true,
          inventory: { create: { workspaceId: wsTarget.id, quantity: 0 } },
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
          inventory: { create: { workspaceId: wsTarget.id, quantity: 0 } },
        },
        select: { id: true, name: true, unit: true, kind: true },
      }),
    )
  }

  console.log('[seed] products', {
    raw: rawProducts.length,
    intermediate: intermediateProducts.length,
    finished: finishedProducts.length,
  })

  // Recipes:
  // - Intermediates consume RAW
  // - Finished consume RAW + INTERMEDIATE
  const recipes = []

  for (const ip of intermediateProducts) {
    const ins = new Set()
    while (ins.size < 3) ins.add(pick(rawProducts).id)
    const items = [...ins].map((pid) => ({ productId: pid, quantity: Number(rnd(0.5, 3).toFixed(3)) }))

    const r = await prisma.recipe.create({
      data: {
        workspaceId: wsTarget.id,
        productId: ip.id,
        yieldQty: 10,
        observations: `Receita base de ${ip.name}`,
        items: { create: items },
      },
      select: { id: true, productId: true },
    })
    recipes.push(r)
  }

  for (const fp of finishedProducts) {
    const insRaw = new Set()
    while (insRaw.size < 2) insRaw.add(pick(rawProducts).id)

    const insInter = new Set()
    while (insInter.size < 1) insInter.add(pick(intermediateProducts).id)

    const items = [
      ...[...insRaw].map((pid) => ({ productId: pid, quantity: Number(rnd(0.5, 3).toFixed(3)) })),
      ...[...insInter].map((pid) => ({ productId: pid, quantity: Number(rnd(0.5, 2).toFixed(3)) })),
    ]

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
  // Some are RECEIVED with unitCost, which will populate avgCost automatically.
  const purchaseOrders = []
  for (let i = 1; i <= 80; i++) {
    if (i % 20 === 0) console.log('[seed] purchaseOrders', i)
    const supplier = pick(suppliers)

    const status = i % 4 === 0 ? 'RECEIVED' : i % 3 === 0 ? 'CONFIRMED' : i % 7 === 0 ? 'CANCELLED' : 'DRAFT'

    const ins = new Set()
    while (ins.size < 3) ins.add(pick(rawProducts).id)
    const items = [...ins].map((pid) => ({
      productId: pid,
      quantity: Number(rnd(5, 35).toFixed(3)),
      unitCost: Number(rnd(0.5, 30).toFixed(2)),
    }))

    const po = await prisma.purchaseOrder.create({
      data: {
        workspaceId: wsTarget.id,
        supplierId: supplier.id,
        supplier: null,
        orderedAt: daysFromNow(-i),
        status,
        receivedAt: status === 'RECEIVED' ? daysFromNow(-Math.max(0, i - 1)) : null,
        estimatedCost: Number(rnd(50, 800).toFixed(2)),
        observations: `PO #${i} (${status})`,
        items: { create: items },
      },
      select: { id: true, status: true, items: { select: { productId: true, quantity: true, unitCost: true } } },
    })
    purchaseOrders.push(po)

    // Seed uses prisma directly, so we replicate the relevant side-effects:
    // - CONFIRMED: create payable commitment (no stock entry)
    // - RECEIVED: stock entry + update avgCost (weighted)
    if (status === 'CONFIRMED') {
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

    if (status === 'RECEIVED') {
      for (const it of po.items) {
        const qtyIn = Number(it.quantity)
        const unitCost = it.unitCost == null ? 0 : Number(it.unitCost)

        const invBefore = await prisma.inventory.findUnique({ where: { productId: it.productId }, select: { quantity: true } })
        const prodBefore = await prisma.product.findUnique({ where: { id: it.productId }, select: { avgCost: true } })

        const currentQty = invBefore?.quantity == null ? 0 : Number(invBefore.quantity)
        const currentAvg = prodBefore?.avgCost == null ? 0 : Number(prodBefore.avgCost)

        await prisma.inventory.update({ where: { productId: it.productId }, data: { quantity: { increment: qtyIn } } })

        // Weighted average: (oldQty*oldAvg + inQty*unitCost) / (oldQty + inQty)
        const denom = currentQty + qtyIn
        const nextAvg = denom > 0 ? (currentQty * currentAvg + qtyIn * unitCost) / denom : unitCost

        await prisma.product.update({ where: { id: it.productId }, data: { avgCost: nextAvg } })
      }
    }
  }

  // Production runs (so avgCost flows RAW -> INTERMEDIATE -> FINISHED)
  async function runProduction(recipeId, producedQty, at, observations) {
    const recipe = await prisma.recipe.findFirst({
      where: { id: recipeId, workspaceId: wsTarget.id },
      select: {
        id: true,
        productId: true,
        yieldQty: true,
        items: { select: { productId: true, quantity: true, product: { select: { kind: true, avgCost: true } } } },
        product: { select: { kind: true } },
      },
    })
    if (!recipe) return

    const yieldQty = recipe.yieldQty == null ? 0 : Number(recipe.yieldQty)
    if (!yieldQty || !Number.isFinite(yieldQty) || yieldQty <= 0) return

    const factor = producedQty / yieldQty

    await prisma.$transaction(async (tx) => {
      const consumed = []
      for (const it of recipe.items) {
        if (it.product.kind !== 'RAW' && it.product.kind !== 'INTERMEDIATE') continue
        const required = Number(it.quantity) * factor
        if (!Number.isFinite(required) || required <= 0) continue
        consumed.push({ productId: it.productId, required })
      }

      // Ensure costs exist
      const prodRows = consumed.length
        ? await tx.product.findMany({
            where: { workspaceId: wsTarget.id, id: { in: consumed.map((c) => c.productId) }, active: true },
            select: { id: true, avgCost: true },
          })
        : []
      const avgById = new Map(prodRows.map((p) => [p.id, p.avgCost == null ? 0 : Number(p.avgCost)]))

      for (const c of consumed) {
        const avg = avgById.get(c.productId) ?? 0
        if (!(Number.isFinite(avg) && avg > 0)) return // skip silently in seed
      }

      // Consume + compute batch cost
      let batchCost = 0
      for (const c of consumed) {
        const avg = avgById.get(c.productId) ?? 0
        batchCost += c.required * avg

        // inventory decrement
        await tx.inventory.update({ where: { productId: c.productId }, data: { quantity: { decrement: c.required } } })

        await tx.consumption.create({
          data: {
            workspaceId: wsTarget.id,
            date: at,
            productId: c.productId,
            quantity: c.required,
            recipeId: recipe.id,
            observations: observations ?? null,
          },
          select: { id: true },
        })
      }

      const unitCostProduced = batchCost / producedQty

      const invBefore = await tx.inventory.findUnique({ where: { productId: recipe.productId }, select: { quantity: true } })
      const productBefore = await tx.product.findUnique({ where: { id: recipe.productId }, select: { avgCost: true } })

      const currentQty = invBefore?.quantity == null ? 0 : Number(invBefore.quantity)
      const currentAvg = productBefore?.avgCost == null ? 0 : Number(productBefore.avgCost)

      await tx.inventory.update({ where: { productId: recipe.productId }, data: { quantity: { increment: producedQty } } })

      const denom = currentQty + producedQty
      const nextAvg = denom > 0 ? (currentQty * currentAvg + producedQty * unitCostProduced) / denom : unitCostProduced

      await tx.product.update({ where: { id: recipe.productId }, data: { avgCost: nextAvg } })
    })
  }

  // Produce intermediates first, then finished.
  const intermediateRecipes = recipes.slice(0, intermediateProducts.length)
  const finishedRecipes = recipes.slice(intermediateProducts.length)

  for (let i = 0; i < intermediateRecipes.length; i++) {
    await runProduction(intermediateRecipes[i].id, 20, daysFromNow(-5 - i), 'Produção seed (intermediário)')
  }
  for (let i = 0; i < finishedRecipes.length; i++) {
    await runProduction(finishedRecipes[i].id, 15, daysFromNow(-2 - i), 'Produção seed (final)')
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
          create: [...picked].map((pid) => ({
            productId: pid,
            quantity: Number(rnd(1, 15).toFixed(3)),
            unitPrice: Number(rnd(5, 120).toFixed(2)),
          })),
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
  console.log('Workspace:', wsTarget)
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

