import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function money(n) {
  // Prisma Decimal accepts number
  return n
}

function nowMinus(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d
}

async function pickAnyUser() {
  const strict = process.env.SEED_STRICT === '1'

  const userId = process.env.USER_ID
  if (userId) {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } })
    if (!u) throw new Error(`USER_ID not found: ${userId}`)
    return u
  }

  const supportEmail = (process.env.SUPPORT_GUARDIAN_EMAIL || 'support.guardian.app@gmail.com').trim().toLowerCase()
  const support = await prisma.user.findUnique({ where: { email: supportEmail }, select: { id: true, email: true } })
  if (support) return support

  const u = await prisma.user.findFirst({ select: { id: true, email: true }, orderBy: { createdAt: 'asc' } })
  if (u) return u

  if (strict) {
    throw new Error('No user found (SEED_STRICT=1). Create a user first (login) or set USER_ID.')
  }

  // Minimal bootstrap: create a demo user so we can create workspace + process records.
  // (No permissions/roles seeding.)
  const created = await prisma.user.create({
    data: {
      name: '[DEMO] Seed User',
      email: 'seed.demo@example.com',
      role: 'USER',
      active: true,
    },
    select: { id: true, email: true },
  })
  return created
}

async function ensureWorkspaceAndMember(userId) {
  const strict = process.env.SEED_STRICT === '1'

  const wsId = process.env.WORKSPACE_ID
  if (wsId) {
    const ws = await prisma.workspace.findUnique({ where: { id: wsId }, select: { id: true, name: true } })
    if (!ws) throw new Error(`WORKSPACE_ID not found: ${wsId}`)

    if (strict) return ws

    // ensure membership
    await prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: ws.id, userId } },
      create: { workspaceId: ws.id, userId, role: 'ADMIN', createdById: userId },
      update: {},
      select: { id: true },
    })

    return ws
  }

  const ws = await prisma.workspace.findFirst({ select: { id: true, name: true }, orderBy: { createdAt: 'asc' } })
  if (ws) {
    if (!strict) {
      await prisma.workspaceMember.upsert({
        where: { workspaceId_userId: { workspaceId: ws.id, userId } },
        create: { workspaceId: ws.id, userId, role: 'ADMIN', createdById: userId },
        update: {},
        select: { id: true },
      })
    }
    return ws
  }

  if (strict) {
    throw new Error('No workspace found (SEED_STRICT=1). Create a workspace first or set WORKSPACE_ID.')
  }

  // Minimal bootstrap: create a demo workspace + membership. No permissions/roles seeding.
  const created = await prisma.workspace.create({
    data: {
      name: '[DEMO] Workspace',
      createdById: userId,
      updatedById: userId,
      members: {
        create: [{ userId, role: 'ADMIN', createdById: userId }],
      },
    },
    select: { id: true, name: true },
  })

  return created
}

async function upsertSupplierAndCustomer(wsId, userId) {
  const supplier = await prisma.client.upsert({
    where: { workspaceId_name: { workspaceId: wsId, name: '[DEMO] Fornecedor Central' } },
    create: {
      workspaceId: wsId,
      createdById: userId,
      name: '[DEMO] Fornecedor Central',
      entityType: 'COMPANY',
      roles: ['SUPPLIER'],
      phone: '+351999000001',
      email: 'fornecedor.demo@example.com',
      observations: 'Seed demo',
    },
    update: {
      updatedById: userId,
      roles: ['SUPPLIER'],
    },
    select: { id: true, name: true },
  })

  const customer = await prisma.client.upsert({
    where: { workspaceId_name: { workspaceId: wsId, name: '[DEMO] Cliente Teste' } },
    create: {
      workspaceId: wsId,
      createdById: userId,
      name: '[DEMO] Cliente Teste',
      entityType: 'PERSON',
      roles: ['CUSTOMER'],
      phone: '+351999000002',
      email: 'cliente.demo@example.com',
      observations: 'Seed demo',
    },
    update: {
      updatedById: userId,
      roles: ['CUSTOMER'],
    },
    select: { id: true, name: true },
  })

  return { supplier, customer }
}

async function ensureAccountsAndCategories(wsId, userId) {
  const cash = await prisma.financialAccount.upsert({
    where: { workspaceId_name: { workspaceId: wsId, name: '[DEMO] Caixa' } },
    create: { workspaceId: wsId, createdById: userId, name: '[DEMO] Caixa', kind: 'CASH', active: true, openingBalance: money(200) },
    update: { updatedById: userId, active: true },
    select: { id: true },
  })

  const bank = await prisma.financialAccount.upsert({
    where: { workspaceId_name: { workspaceId: wsId, name: '[DEMO] Banco' } },
    create: { workspaceId: wsId, createdById: userId, name: '[DEMO] Banco', kind: 'BANK', active: true, openingBalance: money(1000) },
    update: { updatedById: userId, active: true },
    select: { id: true },
  })

  const catSales = await prisma.financialCategory.upsert({
    where: { workspaceId_name_type: { workspaceId: wsId, name: '[DEMO] Vendas', type: 'IN' } },
    create: { workspaceId: wsId, createdById: userId, name: '[DEMO] Vendas', type: 'IN', active: true },
    update: { updatedById: userId, active: true },
    select: { id: true },
  })

  const catPurch = await prisma.financialCategory.upsert({
    where: { workspaceId_name_type: { workspaceId: wsId, name: '[DEMO] Compras', type: 'OUT' } },
    create: { workspaceId: wsId, createdById: userId, name: '[DEMO] Compras', type: 'OUT', active: true },
    update: { updatedById: userId, active: true },
    select: { id: true },
  })

  const cc = await prisma.costCenter.upsert({
    where: { workspaceId_name: { workspaceId: wsId, name: '[DEMO] Operação' } },
    create: { workspaceId: wsId, createdById: userId, name: '[DEMO] Operação', active: true },
    update: { updatedById: userId, active: true },
    select: { id: true },
  })

  return { cash, bank, catSales, catPurch, cc }
}

async function upsertProducts(wsId, userId) {
  const raws = [
    { name: '[DEMO] Farinha de Trigo', unit: 'kg', avgCost: 1.2 },
    { name: '[DEMO] Açúcar', unit: 'kg', avgCost: 0.95 },
    { name: '[DEMO] Manteiga', unit: 'kg', avgCost: 6.5 },
    { name: '[DEMO] Ovos', unit: 'un', avgCost: 0.25 },
    { name: '[DEMO] Leite', unit: 'l', avgCost: 0.9 },
  ]

  const finished = [
    { name: '[DEMO] Bolo Simples', unit: 'un' },
    { name: '[DEMO] Cookie', unit: 'un' },
  ]

  const rawProducts = []
  for (const p of raws) {
    const prod = await prisma.product.upsert({
      where: { workspaceId_name: { workspaceId: wsId, name: p.name } },
      create: { workspaceId: wsId, createdById: userId, name: p.name, brand: 'DEMO', kind: 'RAW', unit: p.unit, active: true, avgCost: money(p.avgCost) },
      update: { updatedById: userId, active: true, avgCost: money(p.avgCost) },
      select: { id: true, name: true, unit: true },
    })
    rawProducts.push(prod)

    await prisma.inventory.upsert({
      where: { productId: prod.id },
      create: { workspaceId: wsId, productId: prod.id, createdById: userId, quantity: 0, minimum: 0 },
      update: { updatedById: userId },
      select: { id: true },
    })
  }

  const finProducts = []
  for (const p of finished) {
    const prod = await prisma.product.upsert({
      where: { workspaceId_name: { workspaceId: wsId, name: p.name } },
      create: { workspaceId: wsId, createdById: userId, name: p.name, brand: 'DEMO', kind: 'FINISHED', unit: p.unit, active: true },
      update: { updatedById: userId, active: true },
      select: { id: true, name: true, unit: true },
    })
    finProducts.push(prod)
    await prisma.inventory.upsert({
      where: { productId: prod.id },
      create: { workspaceId: wsId, productId: prod.id, createdById: userId, quantity: 0, minimum: 0 },
      update: { updatedById: userId },
      select: { id: true },
    })
  }

  return { rawProducts, finProducts }
}

async function upsertBarcodes(wsId, userId, rawProducts) {
  // ProductBarcode is optional (older DBs without the migration)
  let hasTable = false
  try {
    const rows = await prisma.$queryRaw`SELECT to_regclass('public."ProductBarcode"') as tbl;`
    const tbl = Array.isArray(rows) ? rows?.[0]?.tbl : null
    hasTable = Boolean(tbl)
  } catch {
    hasTable = false
  }

  if (!hasTable) {
    console.log('[seed-demo] ProductBarcode table not found, skipping barcode seed.')
    return
  }

  const codes = [
    { code: '5600000000011', idx: 0 },
    { code: '5600000000028', idx: 1 },
    { code: '5600000000035', idx: 2 },
  ]

  for (const c of codes) {
    const product = rawProducts[c.idx]
    if (!product) continue
    await prisma.productBarcode.upsert({
      where: { workspaceId_code: { workspaceId: wsId, code: c.code } },
      create: {
        workspaceId: wsId,
        productId: product.id,
        code: c.code,
        source: 'INTERNAL',
        createdById: userId,
      },
      update: {
        productId: product.id,
      },
      select: { id: true },
    })
  }
}

async function createPurchaseFlow(wsId, userId, supplierId, rawProducts, finance) {
  // Clean previous demo purchase orders (only the last few, safe by supplier + obs tag)
  await prisma.purchaseOrder.deleteMany({ where: { workspaceId: wsId, observations: 'Seed demo (purchases)' } })

  const po = await prisma.purchaseOrder.create({
    data: {
      workspaceId: wsId,
      createdById: userId,
      updatedById: userId,
      supplierId,
      supplier: null,
      orderedAt: nowMinus(2),
      status: 'RECEIVED',
      receivedAt: nowMinus(1),
      estimatedCost: money(120),
      observations: 'Seed demo (purchases)',
      items: {
        create: [
          { productId: rawProducts[0].id, quantity: 10, unitCost: money(1.1), createdById: userId },
          { productId: rawProducts[1].id, quantity: 8, unitCost: money(0.9), createdById: userId },
          { productId: rawProducts[2].id, quantity: 2, unitCost: money(6.2), createdById: userId },
          { productId: rawProducts[3].id, quantity: 30, unitCost: money(0.22), createdById: userId },
        ],
      },
    },
    select: { id: true, items: { select: { productId: true, quantity: true, unitCost: true } } },
  })

  // Apply inventory + avgCost as if it was received (mirrors receive logic)
  for (const it of po.items) {
    const inv = await prisma.inventory.findUnique({ where: { productId: it.productId }, select: { quantity: true } })
    const prod = await prisma.product.findUnique({ where: { id: it.productId }, select: { avgCost: true } })
    const currentQty = inv?.quantity == null ? 0 : Number(inv.quantity)
    const currentAvg = prod?.avgCost == null ? 0 : Number(prod.avgCost)

    const qtyIn = Number(it.quantity)
    const unitCost = Number(it.unitCost ?? 0)

    // inventory +
    await prisma.inventory.update({ where: { productId: it.productId }, data: { quantity: currentQty + qtyIn, updatedById: userId } })

    // avg cost weighted
    const denom = currentQty + qtyIn
    const nextAvg = denom > 0 ? (currentQty * currentAvg + qtyIn * unitCost) / denom : unitCost
    await prisma.product.update({ where: { id: it.productId }, data: { avgCost: nextAvg, updatedById: userId } })
  }

  // Financial entry for purchase (OUT)
  await prisma.financialEntry.create({
    data: {
      workspaceId: wsId,
      createdById: userId,
      updatedById: userId,
      competenceDate: nowMinus(1),
      type: 'OUT',
      status: 'PAID',
      accountId: finance.bank.id,
      categoryId: finance.catPurch.id,
      costCenterId: finance.cc.id,
      value: money(120),
      observations: 'Seed demo (purchase payment)',
      purchaseOrderId: po.id,
      name: '[DEMO] Pagamento fornecedor',
    },
    select: { id: true },
  })

  return po.id
}

async function createSalesFlow(wsId, userId, customerId, rawProducts, finProducts, finance) {
  // Clean previous demo sales orders
  await prisma.salesOrder.deleteMany({ where: { workspaceId: wsId, name: 'Seed demo (sales)' } })

  const so = await prisma.salesOrder.create({
    data: {
      workspaceId: wsId,
      ownerId: userId,
      createdById: userId,
      updatedById: userId,
      name: 'Seed demo (sales)',
      observations: 'Seed demo (sales)',
      clientId: customerId,
      orderedAt: nowMinus(1),
      deliveryAt: nowMinus(0),
      status: 'DONE',
      value: money(85),
      items: {
        create: [
          { productId: finProducts[0].id, quantity: 5, unitPrice: money(10) },
          { productId: finProducts[1].id, quantity: 7, unitPrice: money(5) },
        ],
      },
    },
    select: { id: true },
  })

  // Consume some RAWs as costs/process (Consumption)
  await prisma.consumption.createMany({
    data: [
      { workspaceId: wsId, createdById: userId, updatedById: userId, salesOrderId: so.id, productId: rawProducts[0].id, quantity: 2, observations: 'Seed demo (consumption)' },
      { workspaceId: wsId, createdById: userId, updatedById: userId, salesOrderId: so.id, productId: rawProducts[1].id, quantity: 1.5, observations: 'Seed demo (consumption)' },
      { workspaceId: wsId, createdById: userId, updatedById: userId, salesOrderId: so.id, productId: rawProducts[3].id, quantity: 12, observations: 'Seed demo (consumption)' },
    ],
  })

  // Reflect consumption in inventory
  for (const [pid, delta] of [
    [rawProducts[0].id, -2],
    [rawProducts[1].id, -1.5],
    [rawProducts[3].id, -12],
  ]) {
    const inv = await prisma.inventory.findUnique({ where: { productId: pid }, select: { quantity: true } })
    const current = inv?.quantity == null ? 0 : Number(inv.quantity)
    await prisma.inventory.update({ where: { productId: pid }, data: { quantity: current + Number(delta), updatedById: userId } })
  }

  // Delivery + receivable + payment
  const del = await prisma.delivery.create({
    data: {
      workspaceId: wsId,
      createdById: userId,
      updatedById: userId,
      salesOrderId: so.id,
      clientId: customerId,
      status: 'DELIVERED',
      method: 'PICKUP',
      plannedAt: nowMinus(1),
      shippedAt: nowMinus(1),
      deliveredAt: nowMinus(0),
      value: money(85),
      observations: 'Seed demo (delivery)',
      items: {
        create: [
          { productId: finProducts[0].id, quantity: 5 },
          { productId: finProducts[1].id, quantity: 7 },
        ],
      },
    },
    select: { id: true },
  })

  const recv = await prisma.receivable.create({
    data: {
      workspaceId: wsId,
      createdById: userId,
      updatedById: userId,
      salesOrderId: so.id,
      deliveryId: del.id,
      clientId: customerId,
      status: 'PAID',
      issuedAt: nowMinus(0),
      dueAt: null,
      value: money(85),
    },
    select: { id: true },
  })

  const pay = await prisma.payment.create({
    data: {
      workspaceId: wsId,
      createdById: userId,
      updatedById: userId,
      salesOrderId: so.id,
      clientId: customerId,
      method: 'CASH',
      status: 'RECEIVED',
      receivedAt: nowMinus(0),
      value: money(85),
      reference: 'Seed demo',
      observations: 'Seed demo (payment)',
    },
    select: { id: true },
  })

  await prisma.paymentApplication.create({
    data: {
      workspaceId: wsId,
      createdById: userId,
      updatedById: userId,
      paymentId: pay.id,
      receivableId: recv.id,
      value: money(85),
    },
    select: { id: true },
  })

  // Financial entry for sale (IN)
  await prisma.financialEntry.create({
    data: {
      workspaceId: wsId,
      createdById: userId,
      updatedById: userId,
      competenceDate: nowMinus(0),
      paidAt: nowMinus(0),
      type: 'IN',
      status: 'PAID',
      accountId: finance.cash.id,
      categoryId: finance.catSales.id,
      costCenterId: finance.cc.id,
      value: money(85),
      observations: 'Seed demo (sale)',
      salesOrderId: so.id,
      name: '[DEMO] Recebimento venda',
    },
    select: { id: true },
  })

  return so.id
}

async function main() {
  const user = await pickAnyUser()
  const ws = await ensureWorkspaceAndMember(user.id)

  // Diagnostics: confirm which DB we are connected to
  try {
    const db = await prisma.$queryRaw`SELECT current_database() as db, inet_server_addr() as host, inet_server_port() as port;`
    const row = Array.isArray(db) ? db[0] : null
    console.log(`[seed-demo] db=${row?.db ?? '?'} host=${row?.host ?? '?'} port=${row?.port ?? '?'}`)
  } catch {
    console.log('[seed-demo] db=(unable to query current_database)')
  }

  console.log(`[seed-demo] workspace=${ws.id} (${ws.name}) user=${user.id} (${user.email ?? 'no-email'})`)

  const { supplier, customer } = await upsertSupplierAndCustomer(ws.id, user.id)
  const finance = await ensureAccountsAndCategories(ws.id, user.id)
  const { rawProducts, finProducts } = await upsertProducts(ws.id, user.id)

  await upsertBarcodes(ws.id, user.id, rawProducts)

  const poId = await createPurchaseFlow(ws.id, user.id, supplier.id, rawProducts, finance)
  const soId = await createSalesFlow(ws.id, user.id, customer.id, rawProducts, finProducts, finance)

  console.log(`[seed-demo] ok po=${poId} so=${soId}`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('[seed-demo] failed', e)
    await prisma.$disconnect()
    process.exit(1)
  })
