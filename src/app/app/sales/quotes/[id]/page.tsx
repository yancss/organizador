'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'

import { api } from '@/app/app/api-client'
import { useSettings } from '@/app/app/settings-context'
import { formatMoneyDisplay, localeFromLanguage } from '@/app/app/money'
import { AuditHistory } from '@/app/app/audit-history'
import { EntityFieldsSection } from '@/app/app/entity-fields-section'

type Quote = {
  id: string
  code: string | null
  name: string
  status: string
  validUntil: string | null
  value: string | number | null
  client: { id: string; name: string } | null
  salesOrder: { id: string; code: string | null; status: string } | null
  items: Array<{ id: string; quantity: string | number; unitPrice: string | number; product: { name: string; unit: string } }>
}

export default function QuoteDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id
  const { language, currency } = useSettings()
  const moneyLocale = localeFromLanguage(language)

  const q = useQuery({
    queryKey: ['quote', id],
    enabled: !!id,
    queryFn: () => api<{ quote: Quote }>(`/api/quotes/${id}`),
  })
  const quote = q.data?.quote

  const tt = (pt: string, es: string, en: string) => (language === 'pt' ? pt : language === 'es' ? es : en)

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-theme bg-[var(--surface-2)] px-5 py-5 shadow-[var(--shadow-sm)]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link className="text-sm underline text-[var(--muted-foreground)]" href="/app/sales/quotes">
              {tt('Voltar', 'Volver', 'Back')}
            </Link>
            <h1 className="mt-2 text-xl font-semibold tracking-tight">
              {quote?.code ?? tt('Orçamento', 'Presupuesto', 'Quote')} {quote ? `· ${quote.name}` : ''}
            </h1>
          </div>
        </div>
      </header>

      {q.isLoading ? (
        <p className="text-sm text-[var(--muted-foreground)]">…</p>
      ) : !quote ? (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">NOT_FOUND</div>
      ) : (
        <div className="grid gap-4">
          <section className="grid gap-3 md:grid-cols-4">
            {[
              ['Status', quote.status],
              [tt('Cliente', 'Cliente', 'Client'), quote.client?.name ?? '—'],
              [tt('Válido até', 'Válido hasta', 'Valid until'), quote.validUntil ? quote.validUntil.slice(0, 10) : '—'],
              [tt('Total', 'Total', 'Total'), quote.value != null ? formatMoneyDisplay(quote.value, moneyLocale, currency) : '—'],
            ].map(([k, v]) => (
              <div key={k} className="surface rounded-2xl border border-theme p-4">
                <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{k}</div>
                <div className="mt-1 text-lg font-semibold">{v}</div>
              </div>
            ))}
          </section>

          <section className="surface rounded-2xl border border-theme p-4">
            <h2 className="text-sm font-semibold">{tt('Itens', 'Ítems', 'Items')}</h2>
            <div className="mt-2 space-y-1 text-sm">
              {quote.items.map((it) => (
                <div key={it.id} className="flex justify-between">
                  <span>
                    {it.product.name} — {String(it.quantity)} {it.product.unit}
                  </span>
                  <span>{formatMoneyDisplay(it.unitPrice, moneyLocale, currency)}</span>
                </div>
              ))}
            </div>
            {quote.salesOrder ? (
              <p className="mt-3 text-sm">
                {tt('Pedido gerado', 'Pedido generado', 'Order created')}:{' '}
                <Link className="text-[var(--primary)] underline" href={`/app/sales/orders/${quote.salesOrder.id}`}>
                  {quote.salesOrder.code ?? quote.salesOrder.id.slice(0, 8)}
                </Link>
              </p>
            ) : null}
          </section>

          <EntityFieldsSection entity="SALES_QUOTE" entityId={quote.id} />

          <AuditHistory entityType="SalesQuote" entityId={quote.id} />
        </div>
      )}
    </div>
  )
}
