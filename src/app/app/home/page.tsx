'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'

import { useSettings } from '../settings-context'
import { t } from '../i18n'

async function api<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { 'content-type': 'application/json' } })
  if (!res.ok) throw new Error(await res.text())
  return (await res.json()) as T
}

function Card({
  title,
  value,
  hint,
  href,
}: {
  title: string
  value: string
  hint?: string
  href?: string
}) {
  const inner = (
    <div className="rounded-xl border bg-white p-4">
      <div className="text-sm text-neutral-600">{title}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {hint ? <div className="mt-2 text-xs text-neutral-500">{hint}</div> : null}
    </div>
  )

  if (!href) return inner

  return (
    <Link href={href} className="block hover:opacity-90">
      {inner}
    </Link>
  )
}

type Summary = {
  cards: {
    receivablesOpen: { count: number; total: string | number }
    payablesPlanned: { count: number; total: string | number }
    salesOrdersOpen: { count: number }
    deliveriesOpen: { count: number }
    refundsPending: { count: number }
  }
}

export default function HomePage() {
  const { language } = useSettings()
  const i = t(language)

  const q = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<Summary>('/api/dashboard'),
  })

  const c = q.data?.cards

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{i.home.title}</h1>
        <p className="text-sm text-neutral-600">{i.home.subtitle}</p>
      </div>

      {q.isLoading ? <div>{language === 'pt' ? 'Carregando…' : language === 'es' ? 'Cargando…' : 'Loading…'}</div> : null}
      {q.error ? <div>{language === 'pt' ? 'Erro ao carregar.' : language === 'es' ? 'Error al cargar.' : 'Failed to load.'}</div> : null}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <Card
          title={i.home.receivablesOpen}
          value={c ? `${Number(c.receivablesOpen.total).toFixed(2)} (${c.receivablesOpen.count})` : '-'}
          href="/app/finance/receivables"
        />
        <Card
          title={i.home.payablesPlanned}
          value={c ? `${Number(c.payablesPlanned.total).toFixed(2)} (${c.payablesPlanned.count})` : '-'}
          href="/app/finance/payables"
        />
        <Card
          title={i.home.salesOrdersOpen}
          value={c ? String(c.salesOrdersOpen.count) : '-'}
          href="/app/sales/orders"
        />
        <Card
          title={i.home.deliveriesOpen}
          value={c ? String(c.deliveriesOpen.count) : '-'}
          href="/app/deliveries"
        />
        <Card
          title={i.home.refundsPending}
          value={c ? String(c.refundsPending.count) : '-'}
          href="/app/finance/refunds"
        />
      </div>
    </div>
  )
}
