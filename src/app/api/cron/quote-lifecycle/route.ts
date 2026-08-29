import { prisma } from '@/lib/prisma'
import { enqueueEmail } from '@/lib/email'
import { getSalesQuoteSettings } from '@/lib/sales/sales-quote-settings'

function unauthorized() {
  return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 })
}

function addDays(from: Date, days: number) {
  const d = new Date(from)
  d.setDate(d.getDate() + days)
  return d
}

/**
 * Cron diário do ciclo de vida do orçamento:
 * - expira automaticamente SENT/APPROVED vencidos (quando `autoExpire`);
 * - envia lembrete ao vendedor X dias antes do vencimento (quando `reminderDaysBefore > 0`).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    if ((req.headers.get('authorization') || '') !== `Bearer ${secret}`) return unauthorized()
  } else if (process.env.NODE_ENV === 'production') {
    return Response.json({ error: 'CRON_SECRET_NOT_SET' }, { status: 500 })
  }

  const now = new Date()
  const workspaces = await prisma.workspace.findMany({ select: { id: true } })

  const results: Array<{ workspaceId: string; expired: number; reminded: number }> = []

  for (const ws of workspaces) {
    const settings = await getSalesQuoteSettings(ws.id)
    let expired = 0
    let reminded = 0

    if (settings.autoExpire) {
      const due = await prisma.salesQuote.findMany({
        where: {
          workspaceId: ws.id,
          status: { in: ['SENT', 'APPROVED'] },
          validUntil: { not: null, lt: now },
        },
        select: { id: true, status: true, code: true },
      })
      for (const quote of due) {
        await prisma.$transaction([
          prisma.salesQuote.update({ where: { id: quote.id }, data: { status: 'EXPIRED' }, select: { id: true } }),
          prisma.auditEvent.create({
            data: {
              workspaceId: ws.id,
              category: 'CRUD',
              action: 'UPDATE',
              entityType: 'SalesQuote',
              entityId: quote.id,
              summary: `STATUS SalesQuote ${quote.code ?? quote.id}`,
              changes: { create: [{ field: 'status', from: quote.status, to: 'EXPIRED' }] },
              meta: { via: 'cron:quote-lifecycle' },
            },
            select: { id: true },
          }),
        ])
        expired++
      }
    }

    if (settings.reminderDaysBefore > 0) {
      const horizon = addDays(now, settings.reminderDaysBefore)
      const soon = await prisma.salesQuote.findMany({
        where: {
          workspaceId: ws.id,
          status: 'SENT',
          reminderSentAt: null,
          validUntil: { not: null, gte: now, lte: horizon },
        },
        select: {
          id: true,
          code: true,
          name: true,
          validUntil: true,
          owner: { select: { email: true, name: true } },
          client: { select: { name: true } },
        },
      })
      for (const quote of soon) {
        const email = quote.owner?.email?.trim()
        if (email) {
          const dateStr = quote.validUntil ? quote.validUntil.toISOString().slice(0, 10) : ''
          await enqueueEmail(
            {
              to: email,
              subject: `Orçamento ${quote.code ?? ''} vence em ${settings.reminderDaysBefore} dia(s)`,
              text: `O orçamento "${quote.name}"${quote.client?.name ? ` (${quote.client.name})` : ''} vence em ${dateStr}.`,
            },
            { kind: 'quote-expiry-reminder', quoteId: quote.id },
          ).catch(() => null)
        }
        await prisma.salesQuote.update({ where: { id: quote.id }, data: { reminderSentAt: now }, select: { id: true } })
        reminded++
      }
    }

    if (expired || reminded) results.push({ workspaceId: ws.id, expired, reminded })
  }

  return Response.json({
    ok: true,
    totalExpired: results.reduce((a, r) => a + r.expired, 0),
    totalReminded: results.reduce((a, r) => a + r.reminded, 0),
    results,
  })
}
