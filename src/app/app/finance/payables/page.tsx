'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import DataTable, { type ColumnDef } from '../../ui/data-table'

type Entry = {
  id: string
  competenceDate: string
  paidAt: string | null
  type: 'IN' | 'OUT'
  status: 'PLANNED' | 'PAID'
  value: string | number
  observations: string | null
  account: { id: string; name: string }
  category: { id: string; name: string; type: 'IN' | 'OUT' } | null
  costCenter: { id: string; name: string } | null
  salesOrderId: string | null
  purchaseId: string | null
  consumptionId: string | null
  createdAt: string
  updatedAt: string
}

async function api<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { 'content-type': 'application/json' } })
  if (!res.ok) throw new Error(await res.text())
  return (await res.json()) as T
}

export default function FinancePayablesPage() {
  const q = useQuery({
    queryKey: ['financeEntries', 'payables'],
    queryFn: () => api<{ entries: Entry[] }>('/api/finance/entries?type=OUT&status=PLANNED'),
  })

  const rows = q.data?.entries ?? []

  const columns = useMemo<ColumnDef<Entry>[]>(
    () => [
      { key: 'status', header: 'Status', sortValue: (r) => r.status, render: (r) => r.status },
      {
        key: 'value',
        header: 'Valor',
        sortValue: (r) => Number(r.value),
        render: (r) => String(r.value),
      },
      {
        key: 'competenceDate',
        header: 'Competência',
        sortValue: (r) => new Date(r.competenceDate),
        render: (r) => new Date(r.competenceDate).toLocaleDateString(),
      },
      {
        key: 'category',
        header: 'Categoria',
        searchValue: (r) => r.category?.name ?? '',
        render: (r) => r.category?.name ?? '-',
      },
      {
        key: 'account',
        header: 'Conta',
        searchValue: (r) => r.account.name,
        render: (r) => r.account.name,
      },
      {
        key: 'obs',
        header: 'Obs.',
        searchValue: (r) => r.observations ?? '',
        render: (r) => (r.observations ? r.observations.slice(0, 40) : '-'),
      },
    ],
    [],
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Pagáveis</h1>
        <p className="text-sm text-neutral-600">Contas a pagar (lançamentos OUT planejados).</p>
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        empty={q.isLoading ? 'Carregando…' : q.error ? 'Erro ao carregar.' : 'Sem pagáveis.'}
        initialSort={{ key: 'competenceDate', dir: 'desc' }}
        pageSize={20}
      />
    </div>
  )
}
