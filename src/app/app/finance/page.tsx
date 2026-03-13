'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useSettings } from '../settings-context'
import DataTable from '../ui/data-table'

type Account = { id: string; name: string; kind: string }
type Category = { id: string; name: string; type: 'IN' | 'OUT' }
type CostCenter = { id: string; name: string }

type Entry = {
  id: string
  competenceDate: string
  paidAt: string | null
  type: 'IN' | 'OUT'
  status: 'PLANNED' | 'PAID'
  value: string
  observations: string | null
  account: { id: string; name: string }
  category: { id: string; name: string; type: 'IN' | 'OUT' } | null
  costCenter: { id: string; name: string } | null
  orderId?: string | null
  purchaseId?: string | null
  consumptionId?: string | null
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) throw new Error(await res.text())
  return (await res.json()) as T
}

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

function toDateTimeLocalValue(d: Date) {
  const pad = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

type Draft = {
  id?: string
  type: 'IN' | 'OUT'
  competenceDate: string
  status: 'PAID' | 'PLANNED'
  value: string
  accountId: string
  categoryId: string
  costCenterId: string
  observations: string
}

export default function FinancePage() {
  const qc = useQueryClient()
  const { language, currency } = useSettings()

  const [isOpen, setIsOpen] = useState(false)

  const accountsQ = useQuery({
    queryKey: ['finance', 'accounts'],
    queryFn: () => api<{ accounts: Account[] }>('/api/finance/accounts'),
  })

  const costCentersQ = useQuery({
    queryKey: ['finance', 'cost-centers'],
    queryFn: () => api<{ costCenters: CostCenter[] }>('/api/finance/cost-centers'),
  })

  const [view, setView] = useState<'all' | 'receivable' | 'payable'>('all')

  // Filters
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')

  const categoriesAllQ = useQuery({
    queryKey: ['finance', 'categories', 'all'],
    queryFn: () => api<{ categories: Category[] }>('/api/finance/categories'),
  })

  const entriesQ = useQuery({
    queryKey: ['finance', 'entries', view, from, to, accountId, categoryId],
    queryFn: () => {
      const params = new URLSearchParams()

      if (view === 'receivable') {
        params.set('status', 'PLANNED')
        params.set('type', 'IN')
      } else if (view === 'payable') {
        params.set('status', 'PLANNED')
        params.set('type', 'OUT')
      }

      if (from) params.set('from', new Date(from + 'T00:00:00').toISOString())
      if (to) params.set('to', new Date(to + 'T23:59:59').toISOString())
      if (accountId) params.set('accountId', accountId)
      if (categoryId) params.set('categoryId', categoryId)

      const qs = params.toString()
      return api<{ entries: Entry[] }>(`/api/finance/entries${qs ? `?${qs}` : ''}`)
    },
  })

  const [draft, setDraft] = useState<Draft>(() => ({
    type: 'OUT',
    competenceDate: toDateTimeLocalValue(new Date()),
    status: 'PAID',
    value: '',
    accountId: '',
    categoryId: '',
    costCenterId: '',
    observations: '',
  }))

  const categoriesQ = useQuery({
    queryKey: ['finance', 'categories', draft.type],
    queryFn: () => api<{ categories: Category[] }>(`/api/finance/categories?type=${draft.type}`),
  })

  const createEntryM = useMutation({
    mutationFn: (payload: {
      type: 'IN' | 'OUT'
      competenceDate: string
      status: 'PAID' | 'PLANNED'
      value: number
      accountId: string
      categoryId: string | null
      costCenterId: string | null
      observations: string | null
    }) =>
      api<{ entry: Entry }>('/api/finance/entries', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['finance', 'entries'] })
    },
  })

  const updateEntryM = useMutation({
    mutationFn: (payload: {
      id: string
      type: 'IN' | 'OUT'
      competenceDate: string
      status: 'PAID' | 'PLANNED'
      value: number
      accountId: string
      categoryId: string | null
      costCenterId: string | null
      observations: string | null
    }) =>
      api<{ entry: Entry }>(`/api/finance/entries/${payload.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          type: payload.type,
          competenceDate: payload.competenceDate,
          status: payload.status,
          value: payload.value,
          accountId: payload.accountId,
          categoryId: payload.categoryId,
          costCenterId: payload.costCenterId,
          observations: payload.observations,
        }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['finance', 'entries'] })
    },
  })

  const deleteEntryM = useMutation({
    mutationFn: (id: string) =>
      api<{ ok: true }>(`/api/finance/entries/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['finance', 'entries'] })
    },
  })

  const markPaidM = useMutation({
    mutationFn: (payload: { id: string }) =>
      api<{ entry: Entry }>(`/api/finance/entries/${payload.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'PAID' }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['finance', 'entries'] })
    },
  })

  const accounts = accountsQ.data?.accounts ?? []
  const categories = categoriesQ.data?.categories ?? []
  const categoriesAll = categoriesAllQ.data?.categories ?? []
  const costCenters = costCentersQ.data?.costCenters ?? []
  const entries = entriesQ.data?.entries ?? []

  const moneyTotals = useMemo(() => {
    let income = 0
    let expense = 0
    for (const e of entries) {
      const v = Number(e.value)
      if (e.type === 'IN') income += v
      else expense += v
    }
    return { income, expense, net: income - expense }
  }, [entries])

  function openCreate() {
    const defaultAccountId = accounts[0]?.id ?? ''
    setDraft((d) => ({
      ...d,
      id: undefined,
      competenceDate: toDateTimeLocalValue(new Date()),
      accountId: d.accountId || defaultAccountId,
    }))
    setIsOpen(true)
  }

  function openEdit(entry: Entry) {
    setDraft({
      id: entry.id,
      type: entry.type,
      competenceDate: toDateTimeLocalValue(new Date(entry.competenceDate)),
      status: entry.status,
      value: String(entry.value),
      accountId: entry.account?.id ?? '',
      categoryId: entry.category?.id ?? '',
      costCenterId: entry.costCenter?.id ?? '',
      observations: entry.observations ?? '',
    })
    setIsOpen(true)
  }

  async function save() {
    const value = Number(String(draft.value).replace(',', '.'))
    if (!draft.accountId || !Number.isFinite(value) || value <= 0) return

    const payload = {
      type: draft.type,
      competenceDate: new Date(draft.competenceDate).toISOString(),
      status: draft.status,
      value,
      accountId: draft.accountId,
      categoryId: draft.categoryId ? draft.categoryId : null,
      costCenterId: draft.costCenterId ? draft.costCenterId : null,
      observations: draft.observations.trim() ? draft.observations.trim() : null,
    }

    if (draft.id) {
      await updateEntryM.mutateAsync({ id: draft.id, ...payload })
    } else {
      await createEntryM.mutateAsync(payload)
    }

    setIsOpen(false)
    setDraft((d) => ({ ...d, id: undefined, value: '', observations: '' }))
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {language === 'pt' ? 'Financeiro' : language === 'es' ? 'Finanzas' : 'Finance'}
          </h1>
          <p className="text-sm text-neutral-600">
            {language === 'pt'
              ? 'Lançamentos, contas e visão rápida do caixa.'
              : language === 'es'
                ? 'Movimientos, cuentas y vista rápida.'
                : 'Entries, accounts and quick view.'}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <a
            href="/app/finance/accounts"
            className="rounded-lg border border-theme bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted)]"
          >
            {language === 'pt' ? 'Contas' : language === 'es' ? 'Cuentas' : 'Accounts'}
          </a>
          <a
            href="/app/finance/categories"
            className="rounded-lg border border-theme bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted)]"
          >
            {language === 'pt' ? 'Categorias' : language === 'es' ? 'Categorías' : 'Categories'}
          </a>
          <button
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90"
            onClick={openCreate}
            type="button"
          >
            {language === 'pt' ? 'Novo lançamento' : language === 'es' ? 'Nuevo' : 'New entry'}
          </button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="surface rounded-xl border border-theme p-4 sm:col-span-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-[var(--muted-foreground)]">
              {language === 'pt'
                ? 'Visão'
                : language === 'es'
                  ? 'Vista'
                  : 'View'}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setView('all')}
                className={
                  'rounded-full border px-3 py-1.5 text-xs ' +
                  (view === 'all'
                    ? 'border-neutral-900 bg-neutral-900 text-white'
                    : 'border-theme bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--muted)]')
                }
              >
                {language === 'pt' ? 'Tudo' : language === 'es' ? 'Todo' : 'All'}
              </button>
              <button
                type="button"
                onClick={() => setView('receivable')}
                className={
                  'rounded-full border px-3 py-1.5 text-xs ' +
                  (view === 'receivable'
                    ? 'border-neutral-900 bg-neutral-900 text-white'
                    : 'border-theme bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--muted)]')
                }
              >
                {language === 'pt' ? 'A receber' : language === 'es' ? 'Por cobrar' : 'Receivable'}
              </button>
              <button
                type="button"
                onClick={() => setView('payable')}
                className={
                  'rounded-full border px-3 py-1.5 text-xs ' +
                  (view === 'payable'
                    ? 'border-neutral-900 bg-neutral-900 text-white'
                    : 'border-theme bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--muted)]')
                }
              >
                {language === 'pt' ? 'A pagar' : language === 'es' ? 'Por pagar' : 'Payable'}
              </button>
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-5">
            <label className="grid gap-1">
              <span className="text-[10px] text-[var(--muted-foreground)]">{language === 'pt' ? 'De' : language === 'es' ? 'De' : 'From'}</span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full rounded-lg border border-theme bg-[var(--surface)] px-3 py-2 text-xs"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-[10px] text-[var(--muted-foreground)]">{language === 'pt' ? 'Até' : language === 'es' ? 'Hasta' : 'To'}</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full rounded-lg border border-theme bg-[var(--surface)] px-3 py-2 text-xs"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-[10px] text-[var(--muted-foreground)]">{language === 'pt' ? 'Conta' : language === 'es' ? 'Cuenta' : 'Account'}</span>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full rounded-lg border border-theme bg-[var(--surface)] px-3 py-2 text-xs"
              >
                <option value="">Todas</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1">
              <span className="text-[10px] text-[var(--muted-foreground)]">{language === 'pt' ? 'Categoria' : language === 'es' ? 'Categoría' : 'Category'}</span>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-lg border border-theme bg-[var(--surface)] px-3 py-2 text-xs"
              >
                <option value="">Todas</option>
                {categoriesAll.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid items-end justify-items-end">
              <button
                type="button"
                className="w-fit rounded-lg border border-theme bg-neutral-50 px-3 py-2 text-xs text-neutral-700 hover:bg-neutral-100"
                onClick={() => {
                  setFrom('')
                  setTo('')
                  setAccountId('')
                  setCategoryId('')
                }}
              >
                {language === 'pt' ? 'Limpar filtros' : language === 'es' ? 'Limpiar filtros' : 'Clear filters'}
              </button>
            </div>
          </div>
        </div>
        <div className="surface rounded-xl border border-theme p-4">
          <div className="text-xs text-[var(--muted-foreground)]">{language === 'pt' ? 'Entradas' : language === 'es' ? 'Ingresos' : 'Income'}</div>
          <div className="mt-1 text-lg font-semibold">{fmtMoney(language, currency, moneyTotals.income)}</div>
        </div>
        <div className="surface rounded-xl border border-theme p-4">
          <div className="text-xs text-[var(--muted-foreground)]">{language === 'pt' ? 'Saídas' : language === 'es' ? 'Gastos' : 'Expense'}</div>
          <div className="mt-1 text-lg font-semibold">{fmtMoney(language, currency, moneyTotals.expense)}</div>
        </div>
        <div className="surface rounded-xl border border-theme p-4">
          <div className="text-xs text-[var(--muted-foreground)]">{language === 'pt' ? 'Saldo' : language === 'es' ? 'Balance' : 'Net'}</div>
          <div className="mt-1 text-lg font-semibold">{fmtMoney(language, currency, moneyTotals.net)}</div>
        </div>
      </section>

      {entriesQ.isLoading ? (
        <p className="text-sm text-neutral-600">Carregando…</p>
      ) : entriesQ.isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Erro ao carregar: {String(entriesQ.error)}
        </div>
      ) : (
        <DataTable
          rows={entries}
          empty={language === 'pt' ? 'Nenhum lançamento ainda.' : language === 'es' ? 'Sin movimientos.' : 'No entries yet.'}
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
          initialSort={{ key: 'competenceDate', dir: 'desc' }}
          columns={[
            {
              key: 'actions',
              header: language === 'pt' ? 'Ações' : language === 'es' ? 'Acciones' : 'Actions',
              render: (r) => (
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {r.status === 'PLANNED' ? (
                    <button
                      type="button"
                      className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800 hover:bg-emerald-100"
                      onClick={() => markPaidM.mutate({ id: r.id })}
                    >
                      {r.type === 'IN'
                        ? language === 'pt'
                          ? 'Marcar como recebido'
                          : language === 'es'
                            ? 'Marcar como cobrado'
                            : 'Mark received'
                        : language === 'pt'
                          ? 'Marcar como pago'
                          : language === 'es'
                            ? 'Marcar como pagado'
                            : 'Mark paid'}
                    </button>
                  ) : null}

                  {/* Optional safety: block editing if the entry was generated/linked to another entity */}
                  {!r.orderId && !r.purchaseId && !r.consumptionId ? (
                    <button
                      type="button"
                      className="rounded-md border border-theme bg-[var(--surface)] px-3 py-1.5 text-xs hover:bg-[var(--muted)]"
                      onClick={() => openEdit(r)}
                    >
                      {language === 'pt' ? 'Editar' : language === 'es' ? 'Editar' : 'Edit'}
                    </button>
                  ) : null}

                  <button
                    type="button"
                    className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700 hover:bg-red-100"
                    onClick={() => {
                      if (
                        !confirm(
                          language === 'pt'
                            ? 'Excluir este lançamento?'
                            : language === 'es'
                              ? '¿Eliminar este movimiento?'
                              : 'Delete this entry?'
                        )
                      )
                        return
                      deleteEntryM.mutate(r.id)
                    }}
                  >
                    {language === 'pt' ? 'Excluir' : language === 'es' ? 'Eliminar' : 'Delete'}
                  </button>
                </div>
              ),
            },
            {
              key: 'competenceDate',
              header: language === 'pt' ? 'Data' : language === 'es' ? 'Fecha' : 'Date',
              sortValue: (r) => r.competenceDate,
              searchValue: (r) => r.competenceDate,
              render: (r) => {
                const d = new Date(r.competenceDate)
                return <div className="text-[var(--foreground)]">{d.toLocaleString()}</div>
              },
            },
            {
              key: 'type',
              header: language === 'pt' ? 'Tipo' : language === 'es' ? 'Tipo' : 'Type',
              sortValue: (r) => r.type,
              searchValue: (r) => r.type,
              render: (r) => (
                <span
                  className={
                    'rounded-full border px-2 py-1 text-xs ' +
                    (r.type === 'IN'
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                      : 'border-rose-300 bg-rose-50 text-rose-800')
                  }
                >
                  {r.type === 'IN'
                    ? language === 'pt'
                      ? 'Entrada'
                      : language === 'es'
                        ? 'Ingreso'
                        : 'Income'
                    : language === 'pt'
                      ? 'Saída'
                      : language === 'es'
                        ? 'Gasto'
                        : 'Expense'}
                </span>
              ),
            },
            {
              key: 'value',
              header: language === 'pt' ? 'Valor' : language === 'es' ? 'Importe' : 'Amount',
              sortValue: (r) => Number(r.value),
              searchValue: (r) => r.value,
              render: (r) => <div className="font-medium">{fmtMoney(language, currency, Number(r.value))}</div>,
            },
            {
              key: 'category',
              header: language === 'pt' ? 'Categoria' : language === 'es' ? 'Categoría' : 'Category',
              sortValue: (r) => r.category?.name ?? '',
              searchValue: (r) => r.category?.name ?? '',
              render: (r) => <div className="text-[var(--muted-foreground)]">{r.category?.name ?? '—'}</div>,
            },
            {
              key: 'costCenter',
              header: language === 'pt' ? 'Centro de custo' : language === 'es' ? 'Centro de costo' : 'Cost center',
              sortValue: (r) => r.costCenter?.name ?? '',
              searchValue: (r) => r.costCenter?.name ?? '',
              render: (r) => <div className="text-[var(--muted-foreground)]">{r.costCenter?.name ?? '—'}</div>,
            },
            {
              key: 'account',
              header: language === 'pt' ? 'Conta' : language === 'es' ? 'Cuenta' : 'Account',
              sortValue: (r) => r.account.name,
              searchValue: (r) => r.account.name,
              render: (r) => <div className="text-[var(--muted-foreground)]">{r.account.name}</div>,
            },
          ]}
        />
      )}

      {isOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsOpen(false)} />
          <div className="surface absolute bottom-0 left-0 right-0 mx-auto w-full max-w-2xl rounded-t-2xl border border-theme p-5 shadow-xl sm:bottom-auto sm:top-20 sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">
                  {language === 'pt' ? 'Novo lançamento' : language === 'es' ? 'Nuevo movimiento' : 'New entry'}
                </h2>
                <p className="text-sm text-[var(--text-muted)]">
                  {language === 'pt'
                    ? 'Registre entradas/saídas e vincule a categoria e centro de custo.'
                    : language === 'es'
                      ? 'Registra ingresos/gastos y vincula categoría y centro de costo.'
                      : 'Register income/expense and link category and cost center.'}
                </p>
              </div>
              <button
                aria-label="Fechar"
                className="grid size-9 place-items-center rounded-md text-lg text-[var(--foreground)] hover:bg-[var(--muted)]"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-[var(--foreground)]">{language === 'pt' ? 'Tipo' : language === 'es' ? 'Tipo' : 'Type'}</span>
                  <select
                    value={draft.type}
                    onChange={(e) => {
                      const t = e.target.value as 'IN' | 'OUT'
                      setDraft((d) => ({ ...d, type: t, categoryId: '' }))
                    }}
                    className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                  >
                    <option value="IN">{language === 'pt' ? 'Entrada' : language === 'es' ? 'Ingreso' : 'Income'}</option>
                    <option value="OUT">{language === 'pt' ? 'Saída' : language === 'es' ? 'Gasto' : 'Expense'}</option>
                  </select>
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-medium text-[var(--foreground)]">{language === 'pt' ? 'Status' : language === 'es' ? 'Estado' : 'Status'}</span>
                  <select
                    value={draft.status}
                    onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as any }))}
                    className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                  >
                    <option value="PAID">{language === 'pt' ? 'Pago' : language === 'es' ? 'Pagado' : 'Paid'}</option>
                    <option value="PLANNED">{language === 'pt' ? 'Previsto' : language === 'es' ? 'Previsto' : 'Planned'}</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-[var(--foreground)]">{language === 'pt' ? 'Data (competência)' : language === 'es' ? 'Fecha' : 'Date'}</span>
                  <input
                    type="datetime-local"
                    value={draft.competenceDate}
                    onChange={(e) => setDraft((d) => ({ ...d, competenceDate: e.target.value }))}
                    className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-medium text-[var(--foreground)]">{language === 'pt' ? 'Valor' : language === 'es' ? 'Importe' : 'Amount'}</span>
                  <input
                    inputMode="decimal"
                    value={draft.value}
                    onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))}
                    placeholder={language === 'pt' ? '0,00' : '0.00'}
                    className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                  />
                </label>
              </div>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-[var(--foreground)]">{language === 'pt' ? 'Conta' : language === 'es' ? 'Cuenta' : 'Account'}</span>
                <select
                  value={draft.accountId}
                  onChange={(e) => setDraft((d) => ({ ...d, accountId: e.target.value }))}
                  className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                >
                  <option value="">{language === 'pt' ? 'Selecione…' : language === 'es' ? 'Seleccione…' : 'Select…'}</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                {!accounts.length ? (
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {language === 'pt'
                      ? 'Dica: crie uma conta (ex.: Caixa) em /api/finance/accounts (vamos colocar UI disso depois).'
                      : 'Tip: create an account first.'}
                  </p>
                ) : null}
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-[var(--foreground)]">{language === 'pt' ? 'Categoria' : language === 'es' ? 'Categoría' : 'Category'}</span>
                  <select
                    value={draft.categoryId}
                    onChange={(e) => setDraft((d) => ({ ...d, categoryId: e.target.value }))}
                    className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                  >
                    <option value="">—</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-medium text-[var(--foreground)]">{language === 'pt' ? 'Centro de custo' : language === 'es' ? 'Centro de costo' : 'Cost center'}</span>
                  <select
                    value={draft.costCenterId}
                    onChange={(e) => setDraft((d) => ({ ...d, costCenterId: e.target.value }))}
                    className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                  >
                    <option value="">—</option>
                    {costCenters.map((cc) => (
                      <option key={cc.id} value={cc.id}>
                        {cc.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-[var(--foreground)]">{language === 'pt' ? 'Observações' : language === 'es' ? 'Notas' : 'Notes'}</span>
                <textarea
                  value={draft.observations}
                  onChange={(e) => setDraft((d) => ({ ...d, observations: e.target.value }))}
                  className="min-h-24 w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                className="rounded-lg border border-theme px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)]"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                {language === 'pt' ? 'Cancelar' : language === 'es' ? 'Cancelar' : 'Cancel'}
              </button>
              <button
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
                onClick={save}
                type="button"
                disabled={!draft.accountId || !draft.value.trim() || createEntryM.isPending}
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
