'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import DataTable, { type ColumnDef } from '../../ui/data-table'
import { api } from '../../api-client'
import { t } from '../../i18n'
import { formatMoneyDisplay, localeFromLanguage } from '../../money'
import { useSettings } from '../../settings-context'

type Payable = {
  id: string
  status: 'PLANNED' | 'ACCRUED' | 'PAID' | 'CANCELLED'
  competenceDate: string
  receivedAt: string | null
  paidAt: string | null
  plannedAmount: string | number
  accruedAmount: string | number
  paidAmount: string | number
  observations: string | null
  supplier: { id: string; name: string } | null
  purchaseOrder: {
    id: string
    code: string | null
    status: string
    orderedAt: string | null
    receivedAt: string | null
  }
}

export default function FinancePayablesPage() {
  const { language, currency } = useSettings()
  const i = t(language)
  const moneyLocale = localeFromLanguage(language)

  const q = useQuery({
    queryKey: ['payables'],
    queryFn: () => api<{ payables: Payable[] }>('/api/payables'),
  })

  const rows = q.data?.payables ?? []
  const overview = useMemo(() => {
    const planned = rows.reduce((acc, row) => acc + Number(row.plannedAmount ?? 0), 0)
    const accrued = rows.reduce((acc, row) => acc + Number(row.accruedAmount ?? 0), 0)
    const paid = rows.reduce((acc, row) => acc + Number(row.paidAmount ?? 0), 0)
    return { totalCount: rows.length, planned, accrued, paid }
  }, [rows])

  function statusLabel(status: Payable['status']) {
    if (language === 'pt') {
      if (status === 'PLANNED') return 'Planejado'
      if (status === 'ACCRUED') return 'Recebido'
      if (status === 'PAID') return 'Pago'
      return 'Cancelado'
    }
    if (language === 'es') {
      if (status === 'PLANNED') return 'Planificado'
      if (status === 'ACCRUED') return 'Devengado'
      if (status === 'PAID') return 'Pagado'
      return 'Cancelado'
    }
    if (status === 'PLANNED') return 'Planned'
    if (status === 'ACCRUED') return 'Accrued'
    if (status === 'PAID') return 'Paid'
    return 'Cancelled'
  }

  const columns: ColumnDef<Payable>[] = [
      {
        key: 'status',
        header: 'Status',
        sortValue: (r) => r.status,
        searchValue: (r) => statusLabel(r.status),
        render: (r) => statusLabel(r.status),
      },
      {
        key: 'supplier',
        header: language === 'pt' ? 'Fornecedor' : language === 'es' ? 'Proveedor' : 'Supplier',
        searchValue: (r) => r.supplier?.name ?? '',
        render: (r) => r.supplier?.name ?? '-',
      },
      {
        key: 'purchaseOrder',
        header: language === 'pt' ? 'Pedido' : language === 'es' ? 'Pedido' : 'Order',
        searchValue: (r) => r.purchaseOrder.code ?? '',
        render: (r) => r.purchaseOrder.code ?? '-',
      },
      {
        key: 'plannedAmount',
        header: language === 'pt' ? 'Planejado' : language === 'es' ? 'Planificado' : 'Planned',
        sortValue: (r) => Number(r.plannedAmount),
        render: (r) => formatMoneyDisplay(r.plannedAmount, moneyLocale, currency),
      },
      {
        key: 'accruedAmount',
        header: language === 'pt' ? 'Recebido' : language === 'es' ? 'Devengado' : 'Accrued',
        sortValue: (r) => Number(r.accruedAmount),
        render: (r) => formatMoneyDisplay(r.accruedAmount, moneyLocale, currency),
      },
      {
        key: 'competenceDate',
        header: language === 'pt' ? 'Competencia' : language === 'es' ? 'Competencia' : 'Competence',
        sortValue: (r) => new Date(r.competenceDate),
        render: (r) => new Date(r.competenceDate).toLocaleDateString(moneyLocale),
      },
      {
        key: 'obs',
        header: language === 'pt' ? 'Obs.' : language === 'es' ? 'Obs.' : 'Notes',
        searchValue: (r) => r.observations ?? '',
        render: (r) => (r.observations ? r.observations.slice(0, 40) : '-'),
      },
    ]

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-theme bg-[var(--surface-2)] px-5 py-5 shadow-[var(--shadow-sm)]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Payables control</div>
        <h1 className="mt-2 text-xl font-semibold">{language === 'pt' ? 'Pagaveis' : language === 'es' ? 'Pagaderos' : 'Payables'}</h1>
        <p className="mt-1 max-w-3xl text-sm text-[var(--text-muted)]">
          {language === 'pt'
            ? 'Compromissos operacionais de compra separados do lancamento financeiro.'
            : language === 'es'
              ? 'Compromisos operativos de compra separados del asiento financiero.'
              : 'Operational purchase commitments kept separate from financial entries.'}
        </p>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <div className="surface rounded-2xl border border-theme p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Titulos</div>
          <div className="mt-1 text-2xl font-semibold">{overview.totalCount}</div>
        </div>
        <div className="surface rounded-2xl border border-theme p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Planejado</div>
          <div className="mt-1 text-2xl font-semibold">{formatMoneyDisplay(overview.planned, moneyLocale, currency)}</div>
        </div>
        <div className="surface rounded-2xl border border-theme p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Recebido</div>
          <div className="mt-1 text-2xl font-semibold">{formatMoneyDisplay(overview.accrued, moneyLocale, currency)}</div>
        </div>
        <div className="surface rounded-2xl border border-theme p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Pago</div>
          <div className="mt-1 text-2xl font-semibold">{formatMoneyDisplay(overview.paid, moneyLocale, currency)}</div>
        </div>
      </section>

      <DataTable
        rows={rows}
        columns={columns}
        empty={
          q.isLoading
            ? language === 'pt'
              ? 'Carregando...'
              : language === 'es'
                ? 'Cargando...'
                : 'Loading...'
            : q.error
              ? language === 'pt'
                ? 'Erro ao carregar.'
                : language === 'es'
                  ? 'Error al cargar.'
                  : 'Failed to load.'
              : language === 'pt'
                ? 'Sem pagaveis.'
                : language === 'es'
                  ? 'Sin pagaderos.'
                  : 'No payables.'
        }
        labels={i.table}
        initialSort={{ key: 'competenceDate', dir: 'desc' }}
        pageSize={20}
      />
    </div>
  )
}
