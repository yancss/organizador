import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

import { prisma } from '@/lib/prisma'
import { getExportMaxRows } from '@/lib/export-limits'
import { buildSalesOrdersWhere } from '@/lib/orders-query'

type OrdersExportOrder = Awaited<ReturnType<typeof fetchOrdersForExport>>['orders'][number]

export type OrdersExportResult = {
  content: Buffer | string
  contentType: string
  fileName: string
  rowCount: number
  truncated: boolean
}

function csvEscape(v: unknown) {
  const s = v == null ? '' : String(v)
  if (/[",\n\r;]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

function fmtDate(d?: Date | null) {
  if (!d) return '-'
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy}`
}

function currencySymbol(code?: string | null) {
  const c = (code || '').toUpperCase()
  if (c === 'BRL') return 'R$'
  if (c === 'EUR') return 'EUR'
  if (c === 'USD') return '$'
  return ''
}

function fmtMoney(v: unknown, currency?: string | null) {
  if (v == null) return '-'
  const n = Number(v)
  if (!Number.isFinite(n)) return String(v)
  const sym = currencySymbol(currency)
  return sym ? `${sym} ${n.toFixed(2)}` : n.toFixed(2)
}

export async function fetchOrdersForExport(args: {
  workspaceId: string
  userId: string
  params: URLSearchParams
}) {
  const where = buildSalesOrdersWhere({ wsId: args.workspaceId, userId: args.userId, params: args.params })
  const maxRows = getExportMaxRows()

  const orders = await prisma.salesOrder.findMany({
    where,
    orderBy: [{ deliveryAt: 'asc' }, { createdAt: 'desc' }],
    take: maxRows + 1,
    select: {
      code: true,
      name: true,
      status: true,
      orderedAt: true,
      deliveryAt: true,
      value: true,
      discountMode: true,
      discountType: true,
      discountValue: true,
      discountPercent: true,
      createdAt: true,
      client: { select: { name: true } },
      owner: { select: { name: true, email: true } },
    },
  })

  const truncated = orders.length > maxRows
  const exportOrders = truncated ? orders.slice(0, maxRows) : orders

  return { orders: exportOrders, truncated, maxRows }
}

function buildFileDate() {
  return new Date().toISOString().slice(0, 10)
}

export function buildOrdersCsvExport(orders: OrdersExportOrder[], truncated: boolean, maxRows: number): OrdersExportResult {
  const header = [
    'code',
    'name',
    'client',
    'status',
    'orderedAt',
    'deliveryAt',
    'value_total',
    'discountMode',
    'discountType',
    'discountValue',
    'discountPercent',
    'responsavel',
    'createdAt',
  ]
  const lines = [header.join(';')]

  for (const o of orders) {
    lines.push(
      [
        o.code,
        o.name,
        o.client?.name,
        o.status,
        o.orderedAt ? o.orderedAt.toISOString() : '',
        o.deliveryAt ? o.deliveryAt.toISOString() : '',
        o.value != null ? String(o.value) : '',
        o.discountMode ?? '',
        o.discountType ?? '',
        o.discountValue != null ? String(o.discountValue) : '',
        o.discountPercent != null ? String(o.discountPercent) : '',
        o.owner?.name ?? o.owner?.email ?? '',
        o.createdAt.toISOString(),
      ]
        .map(csvEscape)
        .join(';'),
    )
  }

  if (truncated) {
    lines.push(`"NOTICE";"Export limitado a ${maxRows} pedidos nesta execucao"`)
  }

  return {
    content: lines.join('\n'),
    contentType: 'text/csv; charset=utf-8',
    fileName: `sales-orders-${buildFileDate()}.csv`,
    rowCount: orders.length,
    truncated,
  }
}

export async function buildOrdersPdfExport(
  orders: OrdersExportOrder[],
  truncated: boolean,
  maxRows: number,
  params: URLSearchParams,
  currency?: string | null,
): Promise<OrdersExportResult> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const pageSize: [number, number] = [595.28, 841.89]
  const margin = 36
  const rowH = 14

  const col = {
    code: 75,
    client: 140,
    status: 65,
    deliveryAt: 65,
    discount: 70,
    value: 70,
    owner: 90,
  }

  const headerTitle = 'Relatorio interno - Pedidos de Venda (Resumo)'

  const filtersLineParts: string[] = []
  const dateField = params.get('dateField')
  const from = params.get('from')
  const to = params.get('to')
  if (dateField) filtersLineParts.push(`Data: ${dateField}`)
  if (from || to) filtersLineParts.push(`Periodo: ${from ?? '...'} -> ${to ?? '...'}`)
  const owner = params.get('owner')
  const createdBy = params.get('createdBy')
  if (owner) filtersLineParts.push(`Responsavel: ${owner}`)
  if (createdBy) filtersLineParts.push(`Criado por: ${createdBy}`)
  const statuses = params.getAll('status')
  if (statuses.length) filtersLineParts.push(`Status: ${statuses.join(', ')}`)
  const q = params.get('q')
  if (q) filtersLineParts.push(`Busca: ${q}`)

  const filtersLine = filtersLineParts.join(' | ')

  let page = pdf.addPage(pageSize)
  let y = page.getHeight() - margin

  function newPage() {
    page = pdf.addPage(pageSize)
    y = page.getHeight() - margin
  }

  function drawText(text: string, x: number, yPos: number, size = 10, bold = false, color = rgb(0, 0, 0)) {
    page.drawText(text, { x, y: yPos, size, font: bold ? fontBold : font, color })
  }

  drawText(headerTitle, margin, y, 14, true)
  y -= 18
  drawText(`Gerado em: ${fmtDate(new Date())}`, margin, y, 9)
  y -= 12
  if (filtersLine) {
    drawText(filtersLine, margin, y, 9, false, rgb(0.2, 0.2, 0.2))
    y -= 14
  } else {
    y -= 6
  }

  if (truncated) {
    drawText(`Export limitado a ${maxRows} pedidos nesta execucao`, margin, y, 9, false, rgb(0.7, 0.15, 0.15))
    y -= 14
  }

  function drawTableHeader() {
    const x0 = margin
    drawText('Codigo', x0, y, 10, true)
    drawText('Cliente', x0 + col.code, y, 10, true)
    drawText('Status', x0 + col.code + col.client, y, 10, true)
    drawText('Entrega', x0 + col.code + col.client + col.status, y, 10, true)
    drawText('Desc.', x0 + col.code + col.client + col.status + col.deliveryAt, y, 10, true)
    drawText('Total', x0 + col.code + col.client + col.status + col.deliveryAt + col.discount, y, 10, true)
    drawText('Resp.', x0 + col.code + col.client + col.status + col.deliveryAt + col.discount + col.value, y, 10, true)
    y -= 12
    page.drawLine({
      start: { x: margin, y },
      end: { x: page.getWidth() - margin, y },
      thickness: 1,
      color: rgb(0.85, 0.85, 0.85),
    })
    y -= 10
  }

  drawTableHeader()

  let total = 0
  let totalCount = 0

  for (const o of orders) {
    if (y < margin + 60) {
      newPage()
      drawTableHeader()
    }

    const x0 = margin
    const ownerName = o.owner?.name ?? o.owner?.email ?? '-'
    const code = o.code ?? '-'
    const client = o.client?.name ?? '-'
    const status = String(o.status)
    const delivery = fmtDate(o.deliveryAt)

    const discountLabel =
      o.discountMode === 'PER_ITEM'
        ? 'itens'
        : o.discountType === 'PERCENT'
          ? `${Number(o.discountPercent ?? 0).toFixed(2)}%`
          : fmtMoney(o.discountValue, currency)

    const value = fmtMoney(o.value, currency)

    drawText(code, x0, y, 9)
    drawText(client.slice(0, 26), x0 + col.code, y, 9)
    drawText(status, x0 + col.code + col.client, y, 9)
    drawText(delivery, x0 + col.code + col.client + col.status, y, 9)
    drawText(discountLabel, x0 + col.code + col.client + col.status + col.deliveryAt, y, 9)
    drawText(value, x0 + col.code + col.client + col.status + col.deliveryAt + col.discount, y, 9)
    drawText(ownerName.slice(0, 14), x0 + col.code + col.client + col.status + col.deliveryAt + col.discount + col.value, y, 9)

    y -= rowH
    totalCount += 1
    if (o.value != null) total += Number(o.value)
  }

  if (y < margin + 50) newPage()
  y -= 6
  page.drawLine({
    start: { x: margin, y },
    end: { x: page.getWidth() - margin, y },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  })
  y -= 16

  drawText(`Total de pedidos: ${totalCount}`, margin, y, 10, true)
  y -= 14
  drawText(`Soma (total): ${fmtMoney(total, currency)}`, margin, y, 10, true)

  const bytes = await pdf.save()
  return {
    content: Buffer.from(bytes),
    contentType: 'application/pdf',
    fileName: `sales-orders-${buildFileDate()}.pdf`,
    rowCount: orders.length,
    truncated,
  }
}
