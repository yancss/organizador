'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'

import DataTable, { type ColumnDef } from '../../ui/data-table'
import { api } from '../../api-client'
import { useSettings } from '../../settings-context'
import { t } from '../../i18n'
import { formatMoneyDisplay, localeFromLanguage } from '../../money'

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

function sumApplied(apps: Receivable['applications']) {
  return apps.reduce((acc, a) => acc + Number(a.value ?? 0), 0)
}

export default function FinanceReceivablesPage() {
  const { language, currency } = useSettings()
  const i = t(language)
  const moneyLocale = localeFromLanguage(language)
  const router = useRouter()

  const q = useQuery({
    queryKey: ['receivables'],
    queryFn: () => api<{ receivables: Receivable[] }>('/api/receivables'),
  })

  const rows = q.data?.receivables ?? []
  const overview = useMemo(() => {
    const total = rows.reduce((acc, row) => acc + Number(row.value ?? 0), 0)
    const applied = rows.reduce((acc, row) => acc + sumApplied(row.applications), 0)
    return {
      totalCount: rows.length,
      total,
      applied,
      open: Math.max(0, total - applied),
    }
  }, [rows])

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
        render: (r) => formatMoneyDisplay(r.value, moneyLocale, currency),
      },
      {
        key: 'applied',
        header: 'Aplicado',
        sortValue: (r) => sumApplied(r.applications),
        render: (r) => formatMoneyDisplay(sumApplied(r.applications), moneyLocale, currency),
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
        render: (r) => <code className="text-xs">{r.salesOrderId.slice(0, 8)}...</code>,
      },
      {
        key: 'deliveryId',
        header: 'Entrega',
        searchValue: (r) => r.deliveryId,
        render: (r) => <code className="text-xs">{r.deliveryId.slice(0, 8)}...</code>,
      },
    ],
    [currency, moneyLocale],
  )

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-theme bg-[var(--surface-2)] px-5 py-5 shadow-[var(--shadow-sm)]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Receivables ledger</div>
        <h1 className="mt-2 text-xl font-semibold">Recebiveis</h1>
        <p className="mt-1 max-w-3xl text-sm text-[var(--text-muted)]">Contas a receber reais por expedicao.</p>
      </div>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="surface rounded-2xl border border-theme p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Titulos</div>
          <div className="mt-1 text-2xl font-semibold">{overview.totalCount}</div>
        </div>
        <div className="surface rounded-2xl border border-theme p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Valor total</div>
          <div className="mt-1 text-2xl font-semibold">{formatMoneyDisplay(overview.total, moneyLocale, currency)}</div>
        </div>
        <div className="surface rounded-2xl border border-theme p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Em aberto</div>
          <div className="mt-1 text-2xl font-semibold">{formatMoneyDisplay(overview.open, moneyLocale, currency)}</div>
          <div className="mt-2 text-xs text-[var(--text-muted)]">Aplicado: {formatMoneyDisplay(overview.applied, moneyLocale, currency)}</div>
        </div>
      </section>

      <DataTable
        rows={rows}
        columns={columns}
        empty={q.isLoading ? 'Carregando...' : q.error ? 'Erro ao carregar.' : 'Sem recebiveis.'}
        labels={i.table}
        initialSort={{ key: 'issuedAt', dir: 'desc' }}
        pageSize={20}
        onRowClick={(r) => router.push(`/app/finance/receivables/${r.id}`)}
      />
    </div>
  )
}
