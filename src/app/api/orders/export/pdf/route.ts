import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'
import { buildSalesOrdersWhere } from '@/lib/orders-query'

function fmtDate(d?: Date | null) {
  if (!d) return '—'
  // keep it simple and locale-neutral in PDF
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy}`
}

function currencySymbol(code?: string | null) {
  const c = (code || '').toUpperCase()
  if (c === 'BRL') return 'R$'
  if (c === 'EUR') return '€'
  if (c === 'USD') return '$'
  return ''
}

function fmtMoney(v: any, currency?: string | null) {
  if (v == null) return '—'
  const n = Number(v)
  if (!Number.isFinite(n)) return String(v)
  const sym = currencySymbol(currency)
  return sym ? `${sym} ${n.toFixed(2)}` : n.toFixed(2)
}

export async function GET(req: Request) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  const url = new URL(req.url)
  const currency = url.searchParams.get('currency')
  const where = buildSalesOrdersWhere({ wsId, userId: auth.user.id, params: url.searchParams })

  const orders = await prisma.salesOrder.findMany({
    where,
    orderBy: [{ deliveryAt: 'asc' }, { createdAt: 'desc' }],
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

  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const pageSize: [number, number] = [595.28, 841.89] // A4
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

  const headerTitle = 'Relatório interno — Pedidos de Venda (Resumo)'

  const filtersLineParts: string[] = []
  const dateField = url.searchParams.get('dateField')
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  if (dateField) filtersLineParts.push(`Data: ${dateField}`)
  if (from || to) filtersLineParts.push(`Período: ${from ?? '…'} → ${to ?? '…'}`)
  const owner = url.searchParams.get('owner')
  const createdBy = url.searchParams.get('createdBy')
  if (owner) filtersLineParts.push(`Responsável: ${owner}`)
  if (createdBy) filtersLineParts.push(`Criado por: ${createdBy}`)
  const statuses = url.searchParams.getAll('status')
  if (statuses.length) filtersLineParts.push(`Status: ${statuses.join(', ')}`)
  const q = url.searchParams.get('q')
  if (q) filtersLineParts.push(`Busca: ${q}`)

  const filtersLine = filtersLineParts.join(' · ')

  let page = pdf.addPage(pageSize)
  let y = page.getHeight() - margin

  function newPage() {
    page = pdf.addPage(pageSize)
    y = page.getHeight() - margin
  }

  function drawText(text: string, x: number, y: number, size = 10, bold = false, color = rgb(0, 0, 0)) {
    page.drawText(text, { x, y, size, font: bold ? fontBold : font, color })
  }

  // Title
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

  // Table header
  function drawTableHeader() {
    const x0 = margin
    drawText('Código', x0, y, 10, true)
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

  // Rows
  let total = 0
  let totalCount = 0

  for (const o of orders) {
    if (y < margin + 60) {
      newPage()
      drawTableHeader()
    }

    const x0 = margin
    const ownerName = o.owner?.name ?? o.owner?.email ?? '—'

    const code = o.code ?? '—'
    const client = o.client?.name ?? '—'
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

  // Footer summary
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
  const filename = `sales-orders-${new Date().toISOString().slice(0, 10)}.pdf`

  return new Response(Buffer.from(bytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
