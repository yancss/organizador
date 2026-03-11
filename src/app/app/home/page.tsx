'use client'

import { useQuery } from '@tanstack/react-query'

async function api<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { 'content-type': 'application/json' } })
  if (!res.ok) throw new Error(await res.text())
  return (await res.json()) as T
}

function Card({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="text-sm text-neutral-600">{title}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {hint ? <div className="mt-2 text-xs text-neutral-500">{hint}</div> : null}
    </div>
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
  const q = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<Summary>('/api/dashboard'),
  })

  const c = q.data?.cards

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Home</h1>
        <p className="text-sm text-neutral-600">Resumo do dia e indicadores rápidos.</p>
      </div>

      {q.isLoading ? <div>Carregando…</div> : q.error ? <div>Erro ao carregar.</div> : null}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <Card
          title="A receber (aberto)"
          value={c ? `${Number(c.receivablesOpen.total).toFixed(2)} (${c.receivablesOpen.count})` : '-'}
          hint="Recebíveis reais em aberto"
        />
        <Card
          title="A pagar (planejado)"
          value={c ? `${Number(c.payablesPlanned.total).toFixed(2)} (${c.payablesPlanned.count})` : '-'}
          hint="Lançamentos OUT planejados"
        />
        <Card title="Pedidos (abertos)" value={c ? String(c.salesOrdersOpen.count) : '-'} hint="PV em draft/confirmado" />
        <Card title="Entregas (em andamento)" value={c ? String(c.deliveriesOpen.count) : '-'} hint="Planejada/picking/expedida" />
        <Card title="Devoluções (pendentes)" value={c ? String(c.refundsPending.count) : '-'} hint="Requested/processing" />
      </div>
    </div>
  )
}
