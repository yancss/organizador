'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import DataTable, { type ColumnDef } from '../ui/data-table'

type DeliveryItem = { id: string; quantity: string | number; product: { id: string; name: string; unit: string } }

type Delivery = {
  id: string
  salesOrderId: string
  clientId: string | null
  status: string
  plannedAt: string | null
  shippedAt: string | null
  deliveredAt: string | null
  carrier: string | null
  trackingCode: string | null
  trackingUrl: string | null
  observations: string | null
  value: string | number | null
  receivable: { id: string; status: string; value: string | number } | null
  items: DeliveryItem[]
  createdAt: string
  updatedAt: string
}

async function api<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { 'content-type': 'application/json' } })
  if (!res.ok) throw new Error(await res.text())
  return (await res.json()) as T
}

export default function DeliveriesPage() {
  const q = useQuery({
    queryKey: ['deliveries'],
    queryFn: () => api<{ deliveries: Delivery[] }>('/api/deliveries'),
  })

  const rows = q.data?.deliveries ?? []

  const columns = useMemo<ColumnDef<Delivery>[]>(
    () => [
      {
        key: 'status',
        header: 'Status',
        sortValue: (r) => r.status,
        searchValue: (r) => r.status,
        render: (r) => r.status,
      },
      {
        key: 'salesOrderId',
        header: 'PV',
        sortValue: (r) => r.salesOrderId,
        searchValue: (r) => r.salesOrderId,
        render: (r) => <code className="text-xs">{r.salesOrderId.slice(0, 8)}…</code>,
      },
      {
        key: 'value',
        header: 'Valor',
        sortValue: (r) => Number(r.value ?? 0),
        render: (r) => (r.value == null ? '-' : String(r.value)),
      },
      {
        key: 'shippedAt',
        header: 'Expedido em',
        sortValue: (r) => (r.shippedAt ? new Date(r.shippedAt) : null),
        render: (r) => (r.shippedAt ? new Date(r.shippedAt).toLocaleString() : '-'),
      },
      {
        key: 'receivable',
        header: 'Recebível',
        render: (r) => (r.receivable ? `${r.receivable.status} (${r.receivable.value})` : '-'),
      },
      {
        key: 'items',
        header: 'Itens',
        render: (r) => r.items.length,
      },
    ],
    [],
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Entregas</h1>
        <p className="text-sm text-neutral-600">Lista de entregas/expedições. O recebível nasce quando a entrega vira SHIPPED.</p>
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        empty={q.isLoading ? 'Carregando…' : q.error ? 'Erro ao carregar.' : 'Sem entregas.'}
        initialSort={{ key: 'shippedAt', dir: 'desc' }}
        pageSize={15}
      />
    </div>
  )
}
