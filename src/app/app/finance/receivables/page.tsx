'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import DataTable, { type ColumnDef } from '../../ui/data-table'

type Receivable = {
  id: string
  salesOrderId: string
  deliveryId: string
  clientId: string | null
  status: string
  issuedAt: string
  dueAt: string | null
  value: string | number
  applications: Array<{
    id: string
    value: string | number
    appliedAt: string
    payment: { id: string; method: string; status: string; receivedAt: string }
  }>
  createdAt: string
  updatedAt: string
}

async function api<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { 'content-type': 'application/json' } })
  if (!res.ok) throw new Error(await res.text())
  return (await res.json()) as T
}

function sumApplied(apps: Receivable['applications']) {
  return apps.reduce((acc, a) => acc + Number(a.value ?? 0), 0)
}

export default function FinanceReceivablesPage() {
  const q = useQuery({
    queryKey: ['receivables'],
    queryFn: () => api<{ receivables: Receivable[] }>('/api/receivables'),
  })

  const rows = q.data?.receivables ?? []

  const columns = useMemo<ColumnDef<Receivable>[]>(
    () => [
      {
        key: 'status',
        header: 'Status',
        sortValue: (r) => r.status,
        searchValue: (r) => r.status,
        render: (r) => r.status,
      },
      {
        key: 'value',
        header: 'Valor',
        sortValue: (r) => Number(r.value),
        render: (r) => String(r.value),
      },
      {
        key: 'applied',
        header: 'Aplicado',
        sortValue: (r) => sumApplied(r.applications),
        render: (r) => sumApplied(r.applications).toFixed(2),
      },
      {
        key: 'issuedAt',
        header: 'Emitido em',
        sortValue: (r) => new Date(r.issuedAt),
        render: (r) => new Date(r.issuedAt).toLocaleString(),
      },
      {
        key: 'salesOrderId',
        header: 'PV',
        searchValue: (r) => r.salesOrderId,
        render: (r) => <code className="text-xs">{r.salesOrderId.slice(0, 8)}…</code>,
      },
      {
        key: 'deliveryId',
        header: 'Entrega',
        searchValue: (r) => r.deliveryId,
        render: (r) => <code className="text-xs">{r.deliveryId.slice(0, 8)}…</code>,
      },
    ],
    [],
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Recebíveis</h1>
        <p className="text-sm text-neutral-600">Contas a receber reais (por expedição).</p>
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        empty={q.isLoading ? 'Carregando…' : q.error ? 'Erro ao carregar.' : 'Sem recebíveis.'}
        initialSort={{ key: 'issuedAt', dir: 'desc' }}
        pageSize={20}
      />
    </div>
  )
}
