'use client'

import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import DataTable, { type ColumnDef } from '../../ui/data-table'
import { api } from '../../api-client'
import { t } from '../../i18n'
import { formatMoneyDisplay, localeFromLanguage } from '../../money'
import { useSettings } from '../../settings-context'

type Approval = {
  id: string
  entityType: 'PURCHASE_ORDER' | 'SALES_ORDER' | 'SALES_QUOTE'
  entityId: string
  policyKey: string
  reason: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  amount: string | number | null
  salesOrder?: { code: string | null; name: string; status: string } | null
  salesQuote?: { code: string | null; name: string; status: string } | null
  purchaseOrder?: { code: string | null; status: string; supplierEntity?: { name: string } | null } | null
  requestedBy?: { name: string | null; email: string | null } | null
  decidedBy?: { name: string | null; email: string | null } | null
  createdAt: string
}

export default function WorkflowApprovalsPage() {
  const qc = useQueryClient()
  const { language, currency } = useSettings()
  const i = t(language)
  const moneyLocale = localeFromLanguage(language)

  const q = useQuery({
    queryKey: ['approvals'],
    queryFn: () => api<{ approvals: Approval[] }>('/api/approvals'),
  })
  const meQ = useQuery({
    queryKey: ['me'],
    queryFn: () => api<{ workspace?: { role?: 'USER' | 'ADMIN'; isSuperadmin?: boolean } }>('/api/me'),
  })
  const isAdmin = Boolean(meQ.data?.workspace?.isSuperadmin) || meQ.data?.workspace?.role === 'ADMIN'

  const decideM = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'APPROVED' | 'REJECTED' }) =>
      api(`/api/approvals/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['approvals'] })
    },
  })

  function entityLabel(entityType: Approval['entityType']) {
    const map: Record<Approval['entityType'], [string, string, string]> = {
      PURCHASE_ORDER: ['Compra', 'Compra', 'Purchase'],
      SALES_ORDER: ['Pedido', 'Pedido', 'Sales order'],
      SALES_QUOTE: ['Orçamento', 'Presupuesto', 'Quote'],
    }
    const [pt, es, en] = map[entityType] ?? ['Comercial', 'Comercial', 'Sales']
    return language === 'pt' ? pt : language === 'es' ? es : en
  }

  function statusLabel(status: Approval['status']) {
    if (language === 'pt') {
      if (status === 'PENDING') return 'Pendente'
      if (status === 'APPROVED') return 'Aprovado'
      return 'Rejeitado'
    }
    if (language === 'es') {
      if (status === 'PENDING') return 'Pendiente'
      if (status === 'APPROVED') return 'Aprobado'
      return 'Rechazado'
    }
    if (status === 'PENDING') return 'Pending'
    if (status === 'APPROVED') return 'Approved'
    return 'Rejected'
  }

  function policyReason(policyKey: string) {
    if (policyKey === 'PURCHASE_ORDER_AMOUNT') {
      if (language === 'pt') return 'Pedido de compra acima da alçada padrão'
      if (language === 'es') return 'Pedido de compra por encima del umbral estándar'
      return 'Purchase order above the default approval threshold'
    }
    if (language === 'pt') return 'Pedido com desconto fora da política padrão'
    if (language === 'es') return 'Pedido con descuento fuera de la política estándar'
    return 'Order discount outside the default policy'
  }

  function referenceLabel(row: Approval) {
    if (row.entityType === 'PURCHASE_ORDER') {
      return `${row.purchaseOrder?.code ?? '-'} ${row.purchaseOrder?.supplierEntity?.name ?? ''}`.trim()
    }
    if (row.entityType === 'SALES_QUOTE') {
      return `${row.salesQuote?.code ?? '-'} ${row.salesQuote?.name ?? ''}`.trim()
    }
    return `${row.salesOrder?.code ?? '-'} ${row.salesOrder?.name ?? ''}`.trim()
  }

  const rows = q.data?.approvals ?? []

  const columns: ColumnDef<Approval>[] = [
      {
        key: 'entityType',
        header: language === 'pt' ? 'Tipo' : language === 'es' ? 'Tipo' : 'Type',
        sortValue: (r) => r.entityType,
        searchValue: (r) => entityLabel(r.entityType),
        render: (r) => entityLabel(r.entityType),
      },
      {
        key: 'status',
        header: 'Status',
        sortValue: (r) => r.status,
        searchValue: (r) => statusLabel(r.status),
        render: (r) => statusLabel(r.status),
      },
      {
        key: 'reference',
        header: language === 'pt' ? 'Referência' : language === 'es' ? 'Referencia' : 'Reference',
        searchValue: (r) => referenceLabel(r),
        render: (r) => referenceLabel(r),
      },
      {
        key: 'reason',
        header: language === 'pt' ? 'Motivo' : language === 'es' ? 'Motivo' : 'Reason',
        searchValue: (r) => policyReason(r.policyKey),
        render: (r) => policyReason(r.policyKey),
      },
      {
        key: 'amount',
        header: language === 'pt' ? 'Valor' : language === 'es' ? 'Valor' : 'Amount',
        sortValue: (r) => Number(r.amount ?? 0),
        render: (r) => (r.amount == null ? '-' : formatMoneyDisplay(r.amount, moneyLocale, currency)),
      },
      {
        key: 'createdAt',
        header: language === 'pt' ? 'Criado em' : language === 'es' ? 'Creado el' : 'Created at',
        sortValue: (r) => new Date(r.createdAt),
        render: (r) => new Date(r.createdAt).toLocaleString(moneyLocale),
      },
      {
        key: 'actions',
        header: language === 'pt' ? 'Ações' : language === 'es' ? 'Acciones' : 'Actions',
        render: (r) =>
          r.status === 'PENDING' ? (
            <div className="flex gap-2">
              <button
                className="btn btn-primary btn-sm"
                onClick={(e) => {
                  e.stopPropagation()
                  decideM.mutate({ id: r.id, status: 'APPROVED' })
                }}
                disabled={decideM.isPending}
              >
                {language === 'pt' ? 'Aprovar' : language === 'es' ? 'Aprobar' : 'Approve'}
              </button>
              <button
                className="btn btn-danger-soft btn-sm"
                onClick={(e) => {
                  e.stopPropagation()
                  decideM.mutate({ id: r.id, status: 'REJECTED' })
                }}
                disabled={decideM.isPending}
              >
                {language === 'pt' ? 'Rejeitar' : language === 'es' ? 'Rechazar' : 'Reject'}
              </button>
            </div>
          ) : (
            <span className="text-sm text-[var(--text-muted)]">-</span>
          ),
      },
    ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {language === 'pt' ? 'Aprovações' : language === 'es' ? 'Aprobaciones' : 'Approvals'}
          </h1>
          <p className="text-sm text-neutral-600">
            {language === 'pt'
              ? 'Fila simples de aprovação por alçada para compras e descontos.'
              : language === 'es'
                ? 'Cola simple de aprobación por umbral para compras y descuentos.'
                : 'Simple approval queue for purchase thresholds and discount exceptions.'}
          </p>
        </div>
        {isAdmin ? (
          <Link className="btn btn-secondary btn-sm" href="/app/admin/settings">
            {language === 'pt' ? '⚙ Alçadas' : language === 'es' ? '⚙ Umbrales' : '⚙ Thresholds'}
          </Link>
        ) : null}
      </div>

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
                ? 'Sem aprovações pendentes.'
                : language === 'es'
                  ? 'Sin aprobaciones pendientes.'
                  : 'No pending approvals.'
        }
        labels={i.table}
        initialSort={{ key: 'createdAt', dir: 'desc' }}
        pageSize={20}
      />
    </div>
  )
}
