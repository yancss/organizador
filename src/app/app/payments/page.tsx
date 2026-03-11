'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import DataTable, { type ColumnDef } from '../ui/data-table'

type Payment = {
  id: string
  salesOrderId: string
  clientId: string | null
  method: string
  status: string
  receivedAt: string
  value: string | number
  reference: string | null
  proofUrl: string | null
  observations: string | null
  applications: Array<{ id: string; receivableId: string; value: string | number; appliedAt: string }>
  createdAt: string
  updatedAt: string
}

async function api<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { 'content-type': 'application/json' } })
  if (!res.ok) throw new Error(await res.text())
  return (await res.json()) as T
}

function sumApplied(apps: Payment['applications']) {
  return apps.reduce((acc, a) => acc + Number(a.value ?? 0), 0)
}

export default function PaymentsPage() {
  const q = useQuery({
    queryKey: ['payments'],
    queryFn: () => api<{ payments: Payment[] }>('/api/payments'),
  })

  const rows = q.data?.payments ?? []

  const columns = useMemo<ColumnDef<Payment>[]>(
    () => [
      { key: 'status', header: 'Status', sortValue: (r) => r.status, searchValue: (r) => r.status, render: (r) => r.status },
      { key: 'method', header: 'Método', sortValue: (r) => r.method, searchValue: (r) => r.method, render: (r) => r.method },
      { key: 'value', header: 'Valor', sortValue: (r) => Number(r.value), render: (r) => String(r.value) },
      {
        key: 'applied',
        header: 'Aplicado',
        sortValue: (r) => sumApplied(r.applications),
        render: (r) => sumApplied(r.applications).toFixed(2),
      },
      {
        key: 'receivedAt',
        header: 'Recebido em',
        sortValue: (r) => new Date(r.receivedAt),
        render: (r) => new Date(r.receivedAt).toLocaleString(),
      },
      {
        key: 'salesOrderId',
        header: 'PV',
        searchValue: (r) => r.salesOrderId,
        render: (r) => <code className="text-xs">{r.salesOrderId.slice(0, 8)}…</code>,
      },
    ],
    [],
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Pagamentos</h1>
        <p className="text-sm text-neutral-600">Pagamentos/adiantamentos vinculados ao PV. Podem existir antes da expedição.</p>
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        empty={q.isLoading ? 'Carregando…' : q.error ? 'Erro ao carregar.' : 'Sem pagamentos.'}
        initialSort={{ key: 'receivedAt', dir: 'desc' }}
        pageSize={20}
      />
    </div>
  )
}
