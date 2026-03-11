'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import DataTable, { type ColumnDef } from '../ui/data-table'

type Refund = {
  id: string
  salesOrderId: string
  clientId: string | null
  paymentId: string | null
  status: string
  method: string
  requestedAt: string
  completedAt: string | null
  value: string | number
  reason: string | null
  reference: string | null
  proofUrl: string | null
  observations: string | null
  createdAt: string
  updatedAt: string
}

async function api<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { 'content-type': 'application/json' } })
  if (!res.ok) throw new Error(await res.text())
  return (await res.json()) as T
}

export default function RefundsPage() {
  const q = useQuery({
    queryKey: ['refunds'],
    queryFn: () => api<{ refunds: Refund[] }>('/api/refunds'),
  })

  const rows = q.data?.refunds ?? []

  const columns = useMemo<ColumnDef<Refund>[]>(
    () => [
      { key: 'status', header: 'Status', sortValue: (r) => r.status, searchValue: (r) => r.status, render: (r) => r.status },
      { key: 'method', header: 'Método', sortValue: (r) => r.method, searchValue: (r) => r.method, render: (r) => r.method },
      { key: 'value', header: 'Valor', sortValue: (r) => Number(r.value), render: (r) => String(r.value) },
      {
        key: 'requestedAt',
        header: 'Solicitado em',
        sortValue: (r) => new Date(r.requestedAt),
        render: (r) => new Date(r.requestedAt).toLocaleString(),
      },
      {
        key: 'salesOrderId',
        header: 'PV',
        searchValue: (r) => r.salesOrderId,
        render: (r) => <code className="text-xs">{r.salesOrderId.slice(0, 8)}…</code>,
      },
      {
        key: 'paymentId',
        header: 'Pagamento',
        searchValue: (r) => r.paymentId ?? '',
        render: (r) => (r.paymentId ? <code className="text-xs">{r.paymentId.slice(0, 8)}…</code> : '-'),
      },
    ],
    [],
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Devoluções</h1>
        <p className="text-sm text-neutral-600">Reembolsos/estornos. Ao concluir (DONE), o sistema estorna automaticamente as aplicações do pagamento.</p>
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        empty={q.isLoading ? 'Carregando…' : q.error ? 'Erro ao carregar.' : 'Sem devoluções.'}
        initialSort={{ key: 'requestedAt', dir: 'desc' }}
        pageSize={20}
      />
    </div>
  )
}
