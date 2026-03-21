'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { t } from '../i18n'
import { useSettings } from '../settings-context'
import DataTable from '../ui/data-table'
import { toastCreated, toastUpdated, toastDeleted, toastFailedToSave, toastFailedToDelete } from '../toast'
import { api } from '../api-client'

type CostCenter = { id: string; name: string }

type ReportRow = {
  costCenterId: string | null
  costCenterName: string
  total: number
  count: number
}

// (moved to api-client.ts)


function localeFromLanguage(language: string) {
  if (language === 'pt') return 'pt-PT'
  if (language === 'es') return 'es-ES'
  return 'en-US'
}

function fmtMoney(language: string, currency: string, n: number) {
  try {
    return new Intl.NumberFormat(localeFromLanguage(language), { style: 'currency', currency }).format(n)
  } catch {
    return String(n)
  }
}

function isoDaysAgo(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

export default function CostsPage() {
  const qc = useQueryClient()
  const { language, currency } = useSettings()
  const i = t(language)

  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState('')

  const costCentersQ = useQuery({
    queryKey: ['finance', 'cost-centers'],
    queryFn: () => api<{ costCenters: CostCenter[] }>('/api/finance/cost-centers'),
  })

  const reportQ = useQuery({
    queryKey: ['finance', 'reports', 'costs'],
    queryFn: () => api<{ rows: ReportRow[] }>(`/api/finance/reports/costs?from=${encodeURIComponent(isoDaysAgo(30))}&status=PAID`),
  })

  const createM = useMutation({
    mutationFn: (payload: { name: string }) =>
      api<{ costCenter: CostCenter }>('/api/finance/cost-centers', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['finance', 'cost-centers'] })
      await qc.invalidateQueries({ queryKey: ['finance', 'reports', 'costs'] })
    },
  })

  const costCenters = costCentersQ.data?.costCenters ?? []
  const rows = reportQ.data?.rows ?? []

  const total30 = useMemo(() => rows.reduce((acc, r) => acc + Number(r.total || 0), 0), [rows])

  async function save() {
    const n = name.trim()
    if (!n) return

    try {
      await createM.mutateAsync({ name: n })
      toastCreated(i, 'costCenter')
      setName('')
      setIsOpen(false)
    } catch (e: any) {
      toastFailedToSave(i, String(e?.message ?? ''))
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{i.costs.title}</h1>
          <p className="text-sm text-neutral-600">{i.costs.subtitle}</p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => setIsOpen(true)}
          type="button"
        >
          {i.costs.newCostCenter}
        </button>
      </header>

      <section className="surface rounded-xl border border-theme p-4">
        <div className="text-xs text-[var(--muted-foreground)]">{i.costs.totalPaidLast30Days}</div>
        <div className="mt-1 text-lg font-semibold">{fmtMoney(language, currency, total30)}</div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--foreground)]">{i.costs.reportByCenter30d}</h2>

          {reportQ.isLoading ? (
            <p className="text-sm text-neutral-600">{i.common.loading}</p>
          ) : reportQ.isError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {i.common.loadError} {String(reportQ.error)}
            </div>
          ) : (
            <DataTable
              rows={rows}
              empty={i.costs.emptyReport}
              labels={i.table}
              initialSort={{ key: 'total', dir: 'desc' }}
              columns={[
                {
                  key: 'costCenterName',
                  header: i.costs.columns.center,
                  sortValue: (r) => r.costCenterName,
                  searchValue: (r) => r.costCenterName,
                  render: (r) => <div className="font-medium">{r.costCenterName}</div>,
                },
                {
                  key: 'total',
                  header: i.costs.columns.total,
                  sortValue: (r) => Number(r.total),
                  searchValue: (r) => String(r.total),
                  render: (r) => <div className="font-medium">{fmtMoney(language, currency, Number(r.total))}</div>,
                },
                {
                  key: 'count',
                  header: i.costs.columns.entries,
                  sortValue: (r) => r.count,
                  searchValue: (r) => String(r.count),
                  render: (r) => <div className="text-[var(--muted-foreground)]">{r.count}</div>,
                },
              ]}
            />
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--foreground)]">{i.costs.costCenters}</h2>

          {costCentersQ.isLoading ? (
            <p className="text-sm text-neutral-600">{i.common.loading}</p>
          ) : costCentersQ.isError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {i.common.loadError} {String(costCentersQ.error)}
            </div>
          ) : (
            <DataTable
              rows={costCenters}
              empty={i.costs.emptyCostCenters}
              labels={i.table}
              initialSort={{ key: 'name', dir: 'asc' }}
              columns={[
                {
                  key: 'name',
                  header: i.costs.columns.name,
                  sortValue: (r) => r.name,
                  searchValue: (r) => r.name,
                  render: (r) => <div className="font-medium">{r.name}</div>,
                },
                {
                  key: 'actions',
                  header: i.costs.columns.actions,
                  render: (r) => (
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          const next = prompt(i.costs.renamePrompt, r.name)
                          if (!next) return
                          api<{ costCenter: CostCenter }>(`/api/finance/cost-centers/${r.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ name: next }),
                          })
                            .then(() => {
                              toastUpdated(i, 'costCenter')
                              qc.invalidateQueries({ queryKey: ['finance', 'cost-centers'] })
                              qc.invalidateQueries({ queryKey: ['finance', 'reports', 'costs'] })
                            })
                            .catch((e: any) => toastFailedToSave(i, String(e?.message ?? '')))
                        }}
                      >
                        {i.costs.rename}
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger-soft btn-sm"
                        onClick={() => {
                          if (!confirm(i.costs.disableConfirm)) return
                          api<{ ok: true }>(`/api/finance/cost-centers/${r.id}`, { method: 'DELETE' })
                            .then(() => {
                              toastDeleted(i, 'costCenter')
                              qc.invalidateQueries({ queryKey: ['finance', 'cost-centers'] })
                              qc.invalidateQueries({ queryKey: ['finance', 'reports', 'costs'] })
                            })
                            .catch((e: any) => toastFailedToDelete(i, String(e?.message ?? '')))
                        }}
                      >
                        {i.costs.disable}
                      </button>
                    </div>
                  ),
                },
              ]}
            />
          )}
        </section>
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsOpen(false)} />
          <div className="surface modal-safe absolute bottom-0 left-0 right-0 mx-auto w-full max-w-xl rounded-t-2xl border border-theme p-5 shadow-xl sm:bottom-auto sm:top-20 sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{i.costs.modal.title}</h2>
                <p className="text-sm text-[var(--text-muted)]">{i.costs.modal.subtitleExample}</p>
              </div>
              <button
                aria-label={i.common.close}
                className="btn btn-secondary btn-icon"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1">
                <span className="text-xs font-medium text-[var(--foreground)]">{i.costs.modal.nameLabel}</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                className="btn btn-secondary"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                {i.costs.modal.cancel}
              </button>
              <button
                className="btn btn-primary"
                onClick={save}
                type="button"
                disabled={!name.trim() || createM.isPending}
              >
                {i.costs.modal.save}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
