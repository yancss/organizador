'use client'

import { useMemo, useState } from 'react'
// (icon actions moved back to buttons)
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { t } from '../i18n'
import { useSettings } from '../settings-context'
import DataTable from '../ui/data-table'
import { toastCreated, toastUpdated, toastDeleted, toastFailedToSave, toastFailedToDelete } from '../toast'
import { api } from '../api-client'
import { AuditHistory } from '../audit-history'

type Account = { id: string; name: string; kind: string }
type Category = { id: string; name: string; type: 'IN' | 'OUT' }
type CostCenter = { id: string; name: string }

type Entry = {
  id: string
  code?: string | null
  name?: string | null
  competenceDate: string
  paidAt: string | null
  type: 'IN' | 'OUT'
  status: 'PLANNED' | 'PAID'
  value: string
  observations: string | null
  account: { id: string; name: string }
  category: { id: string; name: string; type: 'IN' | 'OUT' } | null
  costCenter: { id: string; name: string } | null
  salesOrderId?: string | null
  purchaseOrderId?: string | null
  purchaseId?: string | null
  consumptionId?: string | null
  salesOrder?: { id: string; code?: string | null; name: string } | null
  purchaseOrder?: { id: string; code?: string | null } | null
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

function toDateTimeLocalValue(d: Date) {
  const pad = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatFinanceId(code?: string | null, id?: string | null): string {
  if (code && String(code).trim()) return String(code)
  if (id && String(id).trim()) return String(id)
  return ''
}

type Draft = {
  id?: string
  code?: string | null
  name?: string | null
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
  const i = t(language)

  const [isOpen, setIsOpen] = useState(false)
  const [readOnly, setReadOnly] = useState(false)

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
    code: null,
    name: null,
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

  // (mark as paid action moved out for now)

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
    setReadOnly(false)
    setDraft((d) => ({
      ...d,
      id: undefined,
      code: null,
      competenceDate: toDateTimeLocalValue(new Date()),
      accountId: d.accountId || defaultAccountId,
    }))
    setIsOpen(true)
  }

  function openEntry(entry: Entry) {
    const ro = !!entry.salesOrderId || !!entry.purchaseOrderId || !!entry.purchaseId || !!entry.consumptionId
    setReadOnly(ro)
    setDraft({
      id: entry.id,
      code: entry.code ?? null,
      name: entry.name ?? null,
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
    if (readOnly) return

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
      name: draft.name?.trim() ? draft.name.trim() : null,
      observations: draft.observations.trim() ? draft.observations.trim() : null,
    }

    try {
      if (draft.id) {
        await updateEntryM.mutateAsync({ id: draft.id, ...payload })
        toastUpdated(i, 'entry')
      } else {
        await createEntryM.mutateAsync(payload)
        toastCreated(i, 'entry')
      }

      setIsOpen(false)
      setDraft((d) => ({ ...d, id: undefined, code: null, name: null, value: '', observations: '' }))
    } catch (e: any) {
      toastFailedToSave(i, String(e?.message ?? ''))
    }
  }

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-theme bg-[var(--surface-2)] px-5 py-5 shadow-[var(--shadow-sm)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{i.financePage.title}</h1>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <a
              href="/app/finance/accounts"
              className="btn btn-secondary"
            >
              {i.financePage.accounts}
            </a>
            <a
              href="/app/finance/categories"
              className="btn btn-secondary"
            >
              {i.financePage.categories}
            </a>
            <button
              className="btn btn-primary"
              onClick={openCreate}
              type="button"
            >
              {i.financePage.newEntry}
            </button>
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="surface rounded-2xl border border-theme p-4 sm:col-span-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-[var(--muted-foreground)]">{i.financePage.view}</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setView('all')}
                className={
                  'chip ' + (view === 'all' ? 'chip-on' : '')
                }
              >
                {i.financePage.viewAll}
              </button>
              <button
                type="button"
                onClick={() => setView('receivable')}
                className={
                  'chip ' + (view === 'receivable' ? 'chip-on' : '')
                }
              >
                {i.financePage.viewReceivable}
              </button>
              <button
                type="button"
                onClick={() => setView('payable')}
                className={
                  'chip ' + (view === 'payable' ? 'chip-on' : '')
                }
              >
                {i.financePage.viewPayable}
              </button>
            </div>
          </div>

          <div className="mt-3 rounded-2xl bg-[var(--surface-2)] p-3">
            <div className="grid gap-2 sm:grid-cols-5">
            <label className="grid gap-1">
              <span className="text-[10px] text-[var(--muted-foreground)]">{i.financePage.filters.from}</span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full rounded-lg border border-theme bg-[var(--surface)] px-3 py-2 text-xs"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-[10px] text-[var(--muted-foreground)]">{i.financePage.filters.to}</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full rounded-lg border border-theme bg-[var(--surface)] px-3 py-2 text-xs"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-[10px] text-[var(--muted-foreground)]">{i.financePage.filters.account}</span>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full rounded-lg border border-theme bg-[var(--surface)] px-3 py-2 text-xs"
              >
                <option value="">{i.common.all}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1">
              <span className="text-[10px] text-[var(--muted-foreground)]">{i.financePage.filters.category}</span>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-lg border border-theme bg-[var(--surface)] px-3 py-2 text-xs"
              >
                <option value="">{i.common.all}</option>
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
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setFrom('')
                  setTo('')
                  setAccountId('')
                  setCategoryId('')
                }}
              >
                {i.financePage.filters.clear}
              </button>
            </div>
          </div>
          </div>
        </div>
        <div className="surface rounded-2xl border border-theme p-4">
          <div className="text-xs text-[var(--muted-foreground)]">{i.financePage.cards.income}</div>
          <div className="mt-1 text-2xl font-semibold">{fmtMoney(language, currency, moneyTotals.income)}</div>
        </div>
        <div className="surface rounded-2xl border border-theme p-4">
          <div className="text-xs text-[var(--muted-foreground)]">{i.financePage.cards.expense}</div>
          <div className="mt-1 text-2xl font-semibold">{fmtMoney(language, currency, moneyTotals.expense)}</div>
        </div>
        <div className="surface rounded-2xl border border-theme p-4">
          <div className="text-xs text-[var(--muted-foreground)]">{i.financePage.cards.net}</div>
          <div className="mt-1 text-2xl font-semibold">{fmtMoney(language, currency, moneyTotals.net)}</div>
        </div>
      </section>

      {entriesQ.isLoading ? (
        <p className="text-sm text-neutral-600">{i.common.loading}</p>
      ) : entriesQ.isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {i.common.loadError} {String(entriesQ.error)}
        </div>
      ) : (
        <DataTable
          rows={entries}
          empty={i.financePage.empty}
          labels={i.table}
          initialSort={{ key: 'competenceDate', dir: 'desc' }}
          columns={[
            {
              key: 'id',
              header: 'ID',
              sortValue: (r) => r.id,
              searchValue: (r) => r.id,
              render: (r) => (
                <div className="font-mono text-xs text-[var(--muted-foreground)]" title={r.id}>
                  {formatFinanceId(r.code, r.id)}
                </div>
              ),
            },
            {
              key: 'name',
              header: i.financePage.columns.name,
              sortValue: (r) => r.name ?? '',
              searchValue: (r) => r.name ?? '',
              render: (r) => {
                const so = r.salesOrder
                const po = r.purchaseOrder

                if (so) {
                  return (
                    <a className="underline text-[var(--foreground)]" href={`/app/sales/orders?focus=${so.id}`} onClick={(e) => e.stopPropagation()}>
                      {r.name ?? `REF: ${so.code ?? ''}${so.code ? ' - ' : ''}${so.name}`}
                    </a>
                  )
                }

                if (po) {
                  return (
                    <a className="underline text-[var(--foreground)]" href={`/app/purchases/orders?focus=${po.id}`} onClick={(e) => e.stopPropagation()}>
                      {r.name ?? `REF: ${po.code ?? ''}`}
                    </a>
                  )
                }

                return <div className="text-[var(--muted-foreground)]">{r.name ?? '—'}</div>
              },
            },
            {
              key: 'competenceDate',
              header: i.financePage.columns.date,
              sortValue: (r) => r.competenceDate,
              searchValue: (r) => r.competenceDate,
              render: (r) => {
                const d = new Date(r.competenceDate)
                return <div className="text-[var(--foreground)]">{d.toLocaleString()}</div>
              },
            },
            {
              key: 'type',
              header: i.financePage.columns.type,
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
                  {r.type === 'IN' ? i.financePage.types.income : i.financePage.types.expense}
                </span>
              ),
            },
            {
              key: 'value',
              header: i.financePage.columns.amount,
              sortValue: (r) => Number(r.value),
              searchValue: (r) => r.value,
              render: (r) => <div className="font-medium">{fmtMoney(language, currency, Number(r.value))}</div>,
            },
            {
              key: 'category',
              header: i.financePage.columns.category,
              sortValue: (r) => r.category?.name ?? '',
              searchValue: (r) => r.category?.name ?? '',
              render: (r) => <div className="text-[var(--muted-foreground)]">{r.category?.name ?? '—'}</div>,
            },
            {
              key: 'costCenter',
              header: i.financePage.columns.costCenter,
              sortValue: (r) => r.costCenter?.name ?? '',
              searchValue: (r) => r.costCenter?.name ?? '',
              render: (r) => <div className="text-[var(--muted-foreground)]">{r.costCenter?.name ?? '—'}</div>,
            },
            {
              key: 'account',
              header: i.financePage.columns.account,
              sortValue: (r) => r.account.name,
              searchValue: (r) => r.account.name,
              render: (r) => <div className="text-[var(--muted-foreground)]">{r.account.name}</div>,
            },
            {
              key: 'actions',
              header: i.financePage.columns.actions,
              className: 'text-right',
              headerClassName: 'text-right',
              render: (r) => (
                <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEntry(r)}>
                    {i.financePage.actions.edit}
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger-soft btn-sm"
                    onClick={() => {
                      if (!confirm(i.financePage.actions.deleteConfirm)) return
                      deleteEntryM
                        .mutateAsync(r.id)
                        .then(() => toastDeleted(i, 'entry'))
                        .catch((e: any) => toastFailedToDelete(i, String(e?.message ?? '')))
                    }}
                  >
                    {i.financePage.actions.delete}
                  </button>
                </div>
              ),
            },
          ]}
        />
      )}

      {isOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsOpen(false)} />
          <div className="surface modal-safe absolute bottom-0 left-0 right-0 mx-auto w-full max-w-2xl rounded-t-2xl border border-theme p-5 shadow-xl sm:bottom-auto sm:top-20 sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{i.financePage.modal.titleNew}</h2>
                <p className="text-sm text-[var(--text-muted)]">{i.financePage.modal.subtitle}</p>
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
              {draft.id ? <AuditHistory entityType="FinancialEntry" entityId={draft.id} /> : null}

              {draft.id ? (
                <div className="grid gap-1">
                  <span className="text-xs font-medium text-[var(--foreground)]">{i.financePage.modal.id}</span>
                  <input
                    value={formatFinanceId(draft.code, draft.id)}
                    readOnly
                    className="w-full rounded-lg border border-theme bg-transparent px-3 py-2 font-mono text-xs"
                    title={draft.id}
                  />
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-[var(--foreground)]">{i.financePage.modal.type}</span>
                  <select
                    value={draft.type}
                    onChange={(e) => {
                      const t = e.target.value as 'IN' | 'OUT'
                      setDraft((d) => ({ ...d, type: t, categoryId: '' }))
                    }}
                    className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                  >
                    <option value="IN">{i.financePage.types.income}</option>
                    <option value="OUT">{i.financePage.types.expense}</option>
                  </select>
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-medium text-[var(--foreground)]">{i.financePage.modal.status}</span>
                  <select
                    value={draft.status}
                    onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as any }))}
                    disabled={readOnly}
                    className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                  >
                    <option value="PAID">{i.financePage.modal.statusPaid}</option>
                    <option value="PLANNED">{i.financePage.modal.statusPlanned}</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-[var(--foreground)]">{i.financePage.modal.date}</span>
                  <input
                    type="datetime-local"
                    value={draft.competenceDate}
                    onChange={(e) => setDraft((d) => ({ ...d, competenceDate: e.target.value }))}
                    disabled={readOnly}
                    className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-medium text-[var(--foreground)]">{i.financePage.modal.amount}</span>
                  <input
                    inputMode="decimal"
                    value={draft.value}
                    onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))}
                    disabled={readOnly}
                    placeholder={i.financePage.modal.amountPlaceholder}
                    className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                  />
                </label>
              </div>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-[var(--foreground)]">{i.financePage.modal.account}</span>
                <select
                  value={draft.accountId}
                  onChange={(e) => setDraft((d) => ({ ...d, accountId: e.target.value }))}
                  disabled={readOnly}
                  className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                >
                  <option value="">{i.financePage.modal.accountPlaceholder}</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                {!accounts.length ? (
                  <p className="text-xs text-[var(--muted-foreground)]">{i.financePage.modal.noAccountsTip}</p>
                ) : null}
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-[var(--foreground)]">{i.financePage.modal.category}</span>
                  <select
                    value={draft.categoryId}
                    onChange={(e) => setDraft((d) => ({ ...d, categoryId: e.target.value }))}
                    disabled={readOnly}
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
                  <span className="text-xs font-medium text-[var(--foreground)]">{i.financePage.modal.costCenter}</span>
                  <select
                    value={draft.costCenterId}
                    onChange={(e) => setDraft((d) => ({ ...d, costCenterId: e.target.value }))}
                    disabled={readOnly}
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
                <span className="text-xs font-medium text-[var(--foreground)]">{i.financePage.modal.name}</span>
                <input
                  value={draft.name ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  disabled={readOnly}
                  className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-[var(--foreground)]">{i.financePage.modal.observations}</span>
                <textarea
                  value={draft.observations}
                  onChange={(e) => setDraft((d) => ({ ...d, observations: e.target.value }))}
                  disabled={readOnly}
                  className="min-h-24 w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                className="btn btn-secondary"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                {i.financePage.modal.cancel}
              </button>
              <button
                className="btn btn-primary"
                onClick={save}
                type="button"
                disabled={readOnly || !draft.accountId || !draft.value.trim() || createEntryM.isPending}
              >
                {readOnly ? i.financePage.modal.readOnly : i.financePage.modal.save}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
