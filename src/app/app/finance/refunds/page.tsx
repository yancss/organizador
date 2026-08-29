'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import DataTable, { type ColumnDef } from '../../ui/data-table'
import { api } from '../../api-client'
import { useSettings } from '../../settings-context'
import { t } from '../../i18n'
import { formatMoneyDisplay, localeFromLanguage } from '../../money'

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

export default function FinanceRefundsPage() {
  const { language, currency } = useSettings()
  const i = t(language)
  const moneyLocale = localeFromLanguage(language)

  const q = useQuery({
    queryKey: ['refunds'],
    queryFn: () => api<{ refunds: Refund[] }>('/api/refunds'),
  })

  const rows = q.data?.refunds ?? []
  const overview = useMemo(() => {
    const total = rows.reduce((acc, row) => acc + Number(row.value ?? 0), 0)
    const completed = rows.filter((row) => row.completedAt).length
    return { totalCount: rows.length, total, completed }
  }, [rows])

  const columns = useMemo<ColumnDef<Refund>[]>(
    () => [
      { key: 'status', header: 'Status', sortValue: (r) => r.status, searchValue: (r) => r.status, render: (r) => r.status },
      { key: 'method', header: 'Metodo', sortValue: (r) => r.method, searchValue: (r) => r.method, render: (r) => r.method },
      { key: 'value', header: 'Valor', sortValue: (r) => Number(r.value), render: (r) => formatMoneyDisplay(r.value, moneyLocale, currency) },
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
        render: (r) => <code className="text-xs">{r.salesOrderId.slice(0, 8)}...</code>,
      },
      {
        key: 'paymentId',
        header: 'Pagamento',
        searchValue: (r) => r.paymentId ?? '',
        render: (r) => (r.paymentId ? <code className="text-xs">{r.paymentId.slice(0, 8)}...</code> : '-'),
      },
    ],
    [currency, moneyLocale],
  )

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-theme bg-[var(--surface-2)] px-5 py-5 shadow-[var(--shadow-sm)]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Refund operations</div>
        <h1 className="mt-2 text-xl font-semibold">Devolucoes</h1>
        <p className="mt-1 max-w-3xl text-sm text-[var(--text-muted)]">Reembolsos e estornos com impacto automatico nas aplicacoes do pagamento.</p>
      </div>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="surface rounded-2xl border border-theme p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Solicitacoes</div>
          <div className="mt-1 text-2xl font-semibold">{overview.totalCount}</div>
        </div>
        <div className="surface rounded-2xl border border-theme p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Valor total</div>
          <div className="mt-1 text-2xl font-semibold">{formatMoneyDisplay(overview.total, moneyLocale, currency)}</div>
        </div>
        <div className="surface rounded-2xl border border-theme p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Concluidas</div>
          <div className="mt-1 text-2xl font-semibold">{overview.completed}</div>
        </div>
      </section>

      <DataTable
        rows={rows}
        columns={columns}
        empty={q.isLoading ? 'Carregando...' : q.error ? 'Erro ao carregar.' : 'Sem devolucoes.'}
        labels={i.table}
        initialSort={{ key: 'requestedAt', dir: 'desc' }}
        pageSize={20}
      />
    </div>
  )
}
