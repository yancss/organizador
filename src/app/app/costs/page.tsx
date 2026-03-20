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
          <h1 className="text-xl font-semibold tracking-tight">
            {language === 'pt' ? 'Custos' : language === 'es' ? 'Costos' : 'Costs'}
          </h1>
          <p className="text-sm text-neutral-600">
            {language === 'pt'
              ? 'Centros de custo e relatório simples (últimos 30 dias).'
              : language === 'es'
                ? 'Centros de costo y reporte simple (últimos 30 días).'
                : 'Cost centers and simple report (last 30 days).'}
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => setIsOpen(true)}
          type="button"
        >
          {language === 'pt' ? 'Novo centro de custo' : language === 'es' ? 'Nuevo centro' : 'New cost center'}
        </button>
      </header>

      <section className="surface rounded-xl border border-theme p-4">
        <div className="text-xs text-[var(--muted-foreground)]">
          {language === 'pt' ? 'Total de saídas (pago) nos últimos 30 dias' : language === 'es' ? 'Total de gastos (pagado) últimos 30 días' : 'Total expense (paid) last 30 days'}
        </div>
        <div className="mt-1 text-lg font-semibold">{fmtMoney(language, currency, total30)}</div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--foreground)]">
            {language === 'pt' ? 'Relatório por centro (30d)' : language === 'es' ? 'Reporte por centro (30d)' : 'By cost center (30d)'}
          </h2>

          {reportQ.isLoading ? (
            <p className="text-sm text-neutral-600">Carregando…</p>
          ) : reportQ.isError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Erro ao carregar: {String(reportQ.error)}
            </div>
          ) : (
            <DataTable
              rows={rows}
              empty={language === 'pt' ? 'Sem dados.' : language === 'es' ? 'Sin datos.' : 'No data.'}
              labels={{
                showing:
                  language === 'pt'
                    ? 'Mostrando {start}–{end} de {total}'
                    : language === 'es'
                      ? 'Mostrando {start}–{end} de {total}'
                      : 'Showing {start}–{end} of {total}',
                page:
                  language === 'pt'
                    ? 'Página {page} / {pages}'
                    : language === 'es'
                      ? 'Página {page} / {pages}'
                      : 'Page {page} / {pages}',
                previous: language === 'pt' ? 'Anterior' : language === 'es' ? 'Anterior' : 'Previous',
                next: language === 'pt' ? 'Próxima' : language === 'es' ? 'Siguiente' : 'Next',
                searchPlaceholder: language === 'pt' ? 'Buscar…' : language === 'es' ? 'Buscar…' : 'Search…',
                clear: language === 'pt' ? 'Limpar' : language === 'es' ? 'Limpiar' : 'Clear',
                noResults:
                  language === 'pt'
                    ? 'Nenhum registro encontrado para a busca.'
                    : language === 'es'
                      ? 'No se encontraron registros.'
                      : 'No results found.',
              }}
              initialSort={{ key: 'total', dir: 'desc' }}
              columns={[
                {
                  key: 'costCenterName',
                  header: language === 'pt' ? 'Centro' : language === 'es' ? 'Centro' : 'Center',
                  sortValue: (r) => r.costCenterName,
                  searchValue: (r) => r.costCenterName,
                  render: (r) => <div className="font-medium">{r.costCenterName}</div>,
                },
                {
                  key: 'total',
                  header: language === 'pt' ? 'Total' : language === 'es' ? 'Total' : 'Total',
                  sortValue: (r) => Number(r.total),
                  searchValue: (r) => String(r.total),
                  render: (r) => <div className="font-medium">{fmtMoney(language, currency, Number(r.total))}</div>,
                },
                {
                  key: 'count',
                  header: language === 'pt' ? 'Lanç.' : language === 'es' ? 'Mov.' : 'Entries',
                  sortValue: (r) => r.count,
                  searchValue: (r) => String(r.count),
                  render: (r) => <div className="text-[var(--muted-foreground)]">{r.count}</div>,
                },
              ]}
            />
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--foreground)]">
            {language === 'pt' ? 'Centros de custo' : language === 'es' ? 'Centros de costo' : 'Cost centers'}
          </h2>

          {costCentersQ.isLoading ? (
            <p className="text-sm text-neutral-600">Carregando…</p>
          ) : costCentersQ.isError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Erro ao carregar: {String(costCentersQ.error)}
            </div>
          ) : (
            <DataTable
              rows={costCenters}
              empty={language === 'pt' ? 'Nenhum centro de custo.' : language === 'es' ? 'Sin centros.' : 'No cost centers.'}
              labels={{
                showing:
                  language === 'pt'
                    ? 'Mostrando {start}–{end} de {total}'
                    : language === 'es'
                      ? 'Mostrando {start}–{end} de {total}'
                      : 'Showing {start}–{end} of {total}',
                page:
                  language === 'pt'
                    ? 'Página {page} / {pages}'
                    : language === 'es'
                      ? 'Página {page} / {pages}'
                      : 'Page {page} / {pages}',
                previous: language === 'pt' ? 'Anterior' : language === 'es' ? 'Anterior' : 'Previous',
                next: language === 'pt' ? 'Próxima' : language === 'es' ? 'Siguiente' : 'Next',
                searchPlaceholder: language === 'pt' ? 'Buscar…' : language === 'es' ? 'Buscar…' : 'Search…',
                clear: language === 'pt' ? 'Limpar' : language === 'es' ? 'Limpiar' : 'Clear',
                noResults:
                  language === 'pt'
                    ? 'Nenhum registro encontrado para a busca.'
                    : language === 'es'
                      ? 'No se encontraron registros.'
                      : 'No results found.',
              }}
              initialSort={{ key: 'name', dir: 'asc' }}
              columns={[
                {
                  key: 'name',
                  header: language === 'pt' ? 'Nome' : language === 'es' ? 'Nombre' : 'Name',
                  sortValue: (r) => r.name,
                  searchValue: (r) => r.name,
                  render: (r) => <div className="font-medium">{r.name}</div>,
                },
                {
                  key: 'actions',
                  header: language === 'pt' ? 'Ações' : language === 'es' ? 'Acciones' : 'Actions',
                  render: (r) => (
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          const next = prompt(language === 'pt' ? 'Novo nome do centro:' : 'New center name:', r.name)
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
                        {language === 'pt' ? 'Renomear' : language === 'es' ? 'Renombrar' : 'Rename'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger-soft btn-sm"
                        onClick={() => {
                          if (
                            !confirm(
                              language === 'pt'
                                ? 'Desativar este centro de custo?'
                                : language === 'es'
                                  ? '¿Desactivar este centro?'
                                  : 'Disable this cost center?'
                            )
                          )
                            return
                          api<{ ok: true }>(`/api/finance/cost-centers/${r.id}`, { method: 'DELETE' })
                            .then(() => {
                              toastDeleted(i, 'costCenter')
                              qc.invalidateQueries({ queryKey: ['finance', 'cost-centers'] })
                              qc.invalidateQueries({ queryKey: ['finance', 'reports', 'costs'] })
                            })
                            .catch((e: any) => toastFailedToDelete(i, String(e?.message ?? '')))
                        }}
                      >
                        {language === 'pt' ? 'Desativar' : language === 'es' ? 'Desactivar' : 'Disable'}
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
                <h2 className="text-lg font-semibold">
                  {language === 'pt' ? 'Novo centro de custo' : language === 'es' ? 'Nuevo centro de costo' : 'New cost center'}
                </h2>
                <p className="text-sm text-[var(--text-muted)]">
                  {language === 'pt'
                    ? 'Ex.: Produção, Delivery, Administrativo, Loja…'
                    : language === 'es'
                      ? 'Ej.: Producción, Delivery, Administrativo…'
                      : 'Example: Production, Delivery, Admin…'}
                </p>
              </div>
              <button
                aria-label="Fechar"
                className="btn btn-secondary btn-icon"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1">
                <span className="text-xs font-medium text-[var(--foreground)]">{language === 'pt' ? 'Nome' : language === 'es' ? 'Nombre' : 'Name'}</span>
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
                {language === 'pt' ? 'Cancelar' : language === 'es' ? 'Cancelar' : 'Cancel'}
              </button>
              <button
                className="btn btn-primary"
                onClick={save}
                type="button"
                disabled={!name.trim() || createM.isPending}
              >
                {language === 'pt' ? 'Salvar' : language === 'es' ? 'Guardar' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
