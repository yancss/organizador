'use client'

import { useMemo, useState } from 'react'

import { useDraftStorage } from './use-draft-storage'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import ptBrLocale from '@fullcalendar/core/locales/pt-br'
import esLocale from '@fullcalendar/core/locales/es'
import enGbLocale from '@fullcalendar/core/locales/en-gb'

import { t } from './i18n'
import { localeFromLanguage, formatMoneyDisplay, formatMoneyFromInput, formatMoneyFromNumber, parseMoneyToNumber } from './money'
import { useSettings, type AppLanguage } from './settings-context'

type Client = { id: string; name: string }

type Product = { id: string; name: string; unit: string }

type OrderItem = {
  productId: string
  quantity: string // input
}

type Order = {
  id: string
  name: string
  observations: string | null
  orderedAt: string | null
  deliveryAt: string | null
  delivered: boolean
  value: string | number | null
  client: Client | null
  items: Array<{ id: string; quantity: string | number; product: Product }>
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

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function toLocalInputValue(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function toLocalDateOnly(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function calendarLocale(language: AppLanguage) {
  if (language === 'pt') return ptBrLocale
  if (language === 'es') return esLocale
  return enGbLocale
}

function fromLocalInputValue(v: string): string | null {
  if (!v.trim()) return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

type Draft = {
  id?: string
  name: string
  clientId: string
  orderedAt: string
  deliveryAt: string
  delivered: boolean
  value: string
  observations: string
  items: OrderItem[]
}

function emptyDraft(): Draft {
  return {
    name: '',
    clientId: '',
    orderedAt: '',
    deliveryAt: '',
    delivered: false,
    value: '',
    observations: '',
    items: [],
  }
}

export default function OrderBoard({ view }: { view: 'upcoming' | 'history' }) {
  const qc = useQueryClient()
  const { language, currency } = useSettings()
  const i = t(language)
  const moneyLocale = localeFromLanguage(language)

  const [isOpen, setIsOpen] = useState(false)
  const draftStore = useDraftStorage<Draft>('draft:orders', emptyDraft)
  const draft = draftStore.value
  const setDraft = draftStore.setValue

  const productsQ = useQuery({
    queryKey: ['products', 'FINISHED'],
    queryFn: () => api<{ products: Product[] }>('/api/products?kind=FINISHED'),
  })

  const clientsQ = useQuery({
    queryKey: ['clients'],
    queryFn: () => api<{ clients: Client[] }>('/api/clients'),
  })

  const ordersQ = useQuery({
    queryKey: ['orders', view],
    queryFn: () => api<{ orders: Order[] }>(`/api/orders?view=${view}`),
  })

  const createM = useMutation({
    mutationFn: (payload: any) =>
      api<{ order: Order }>('/api/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['orders'] })
    },
  })

  const updateM = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      api<{ order: Order }>(`/api/orders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['orders'] })
    },
  })

  const deleteM = useMutation({
    mutationFn: (id: string) => api<{ ok: true }>(`/api/orders/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['orders'] })
    },
  })

  const orders = ordersQ.data?.orders ?? []

  const sorted = useMemo(() => {
    const items = [...orders]
    items.sort((a, b) => {
      const ad = a.deliveryAt ?? '9999-12-31'
      const bd = b.deliveryAt ?? '9999-12-31'
      return ad.localeCompare(bd)
    })
    return items
  }, [orders])

  function openCreate() {
    draftStore.clear()
    setIsOpen(true)
  }

  function openEdit(o: Order) {
    setDraft({
      id: o.id,
      name: o.name,
      clientId: o.client?.id ?? '',
      orderedAt: toLocalInputValue(o.orderedAt),
      deliveryAt: toLocalInputValue(o.deliveryAt),
      delivered: o.delivered,
      value: o.value == null ? '' : formatMoneyFromNumber(Number(o.value), moneyLocale),
      observations: o.observations ?? '',
      items: o.items.map((it) => ({ productId: it.product.id, quantity: String(it.quantity) })),
    })
    setIsOpen(true)
  }

  function addItemLine() {
    const products = productsQ.data?.products ?? []
    const used = new Set(draft.items.map((it) => it.productId))
    const firstAvailable = products.find((p) => !used.has(p.id))?.id ?? products[0]?.id ?? ''
    setDraft((d) => ({ ...d, items: [...d.items, { productId: firstAvailable, quantity: '1' }] }))
  }

  function updateItemLine(idx: number, patch: Partial<OrderItem>) {
    setDraft((d) => ({
      ...d,
      items: d.items.map((it, i2) => (i2 === idx ? { ...it, ...patch } : it)),
    }))
  }

  function removeItemLine(idx: number) {
    setDraft((d) => ({ ...d, items: d.items.filter((_, i2) => i2 !== idx) }))
  }

  async function save() {
    const name = draft.name.trim()
    if (!name) return

    // Consolidar itens repetidos (evita duplicidade e respeita @@unique([orderId, productId]))
    const consolidated = new Map<string, number>()
    for (const it of draft.items) {
      if (!it.productId || !it.quantity.trim()) continue
      const q = Number(it.quantity.replace(',', '.'))
      if (!Number.isFinite(q) || q <= 0) continue
      consolidated.set(it.productId, (consolidated.get(it.productId) ?? 0) + q)
    }

    const payload = {
      name,
      observations: draft.observations.trim() ? draft.observations : null,
      clientId: draft.clientId || null,
      orderedAt: fromLocalInputValue(draft.orderedAt),
      deliveryAt: fromLocalInputValue(draft.deliveryAt),
      delivered: draft.delivered,
      value: parseMoneyToNumber(draft.value, moneyLocale),
      items: Array.from(consolidated.entries()).map(([productId, quantity]) => ({ productId, quantity })),
    }

    if (draft.id) {
      await updateM.mutateAsync({ id: draft.id, payload })
    } else {
      await createM.mutateAsync(payload)
    }

    setIsOpen(false)
    draftStore.clear()
  }

  async function remove() {
    if (!draft.id) return
    if (!confirm(i.modal.deleteConfirm)) return
    await deleteM.mutateAsync(draft.id)
    setIsOpen(false)
    draftStore.clear()
  }

  const calendarEvents = useMemo(() => {
    if (view !== 'upcoming') return []
    return (ordersQ.data?.orders ?? [])
      .filter((o) => !!o.deliveryAt)
      .map((o) => {
        const delivered = !!o.delivered
        return {
          id: o.id,
          title: o.client?.name ? `${o.name} — ${o.client.name}` : o.name,
          start: toLocalDateOnly(o.deliveryAt as string),
          allDay: true,
          backgroundColor: delivered ? '#16a34a' : '#2563eb',
          borderColor: delivered ? '#15803d' : '#1d4ed8',
          textColor: '#ffffff',
        }
      })
  }, [ordersQ.data, view])

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {view === 'history' ? i.orders.historyTitle : i.orders.title}
          </h1>
          <p className="text-sm text-neutral-600">
            {view === 'history' ? i.orders.historySubtitle : i.orders.subtitle}
          </p>
        </div>

        {view === 'upcoming' ? (
          <button
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90"
            onClick={openCreate}
            type="button"
          >
            {i.orders.new}
          </button>
        ) : null}
      </header>

      {ordersQ.isLoading ? (
        <p className="text-sm text-neutral-600">Carregando…</p>
      ) : ordersQ.isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Erro ao carregar: {String(ordersQ.error)}
        </div>
      ) : view === 'upcoming' ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="surface rounded-xl border border-theme">
            <div className="divide-y">
              {sorted.length === 0 ? (
                <div className="p-6 text-sm text-neutral-700">{i.orders.empty}</div>
              ) : (
                <ul>
                  {sorted.map((o) => (
                    <li key={o.id} className="p-4 hover:bg-[var(--muted)]">
                      <button type="button" onClick={() => openEdit(o)} className="w-full text-left">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2">
                              <div className="font-medium text-neutral-900">{o.name}</div>
                              {o.delivered ? (
                                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                                  {i.orders.delivered}
                                </span>
                              ) : null}
                            </div>

                            <div className="mt-1 text-sm text-neutral-700">
                              {o.client?.name ? (
                                <span>
                                  {i.orders.client}: {o.client.name}
                                </span>
                              ) : (
                                <span className="text-neutral-500">{i.orders.noClient}</span>
                              )}
                              {o.value != null ? <span className="ml-2">• {i.orders.value}: {formatMoneyDisplay(o.value, moneyLocale, currency)}</span> : null}
                            </div>

                            {o.observations ? (
                              <div className="mt-1 line-clamp-2 text-sm text-neutral-700">{o.observations}</div>
                            ) : null}

                            <div className="mt-2 text-xs text-neutral-700">
                              {o.deliveryAt ? `${i.orders.deliveryAt}: ${new Date(o.deliveryAt).toLocaleDateString()}` : i.orders.noDeliveryAt}
                            </div>

                            {o.items?.length ? (
                              <div className="mt-2 text-xs text-neutral-700">
                                {o.items
                                  .map((it) => `${it.product.name} (${it.quantity} ${it.product.unit})`)
                                  .join(' • ')}
                              </div>
                            ) : null}
                          </div>
                          <div className="text-xs text-neutral-600">{i.orders.editHint}</div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="surface rounded-xl border border-theme p-2 sm:p-3">
            <FullCalendar
              plugins={[dayGridPlugin, interactionPlugin]}
              locale={calendarLocale(language)}
              buttonText={{
                today: i.calendar.today,
                month: i.calendar.month,
                week: i.calendar.week,
                day: i.calendar.day,
                list: i.calendar.list,
              }}
              initialView="dayGridMonth"
              height={650}
              events={calendarEvents}
              eventClick={(info) => {
                const found = (ordersQ.data?.orders ?? []).find((o) => o.id === info.event.id)
                if (found) openEdit(found)
              }}
            />
          </section>
        </div>
      ) : (
        <section className="surface rounded-xl border border-theme">
          <div className="divide-y">
            {sorted.length === 0 ? (
              <div className="p-6 text-sm text-neutral-700">{i.orders.empty}</div>
            ) : (
              <ul>
                {sorted.map((o) => (
                  <li key={o.id} className="p-4 hover:bg-[var(--muted)]">
                    <button type="button" onClick={() => openEdit(o)} className="w-full text-left">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2">
                            <div className="font-medium text-neutral-900">{o.name}</div>
                            {o.delivered ? (
                              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                                {i.orders.delivered}
                              </span>
                            ) : null}
                          </div>

                          <div className="mt-1 text-sm text-neutral-700">
                            {o.client?.name ? (
                              <span>
                                {i.orders.client}: {o.client.name}
                              </span>
                            ) : (
                              <span className="text-neutral-500">{i.orders.noClient}</span>
                            )}
                            {o.value != null ? <span className="ml-2">• {i.orders.value}: {formatMoneyDisplay(o.value, moneyLocale, currency)}</span> : null}
                          </div>

                          <div className="mt-2 text-xs text-neutral-700">
                            {o.deliveryAt ? `${i.orders.deliveryAt}: ${new Date(o.deliveryAt).toLocaleDateString()}` : i.orders.noDeliveryAt}
                          </div>
                        </div>
                        <div className="text-xs text-neutral-600">{i.orders.editHint}</div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {isOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsOpen(false)} />
          <div className="surface absolute bottom-0 left-0 right-0 mx-auto w-full max-w-2xl rounded-t-2xl border border-theme p-5 shadow-xl sm:bottom-auto sm:top-20 sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{draft.id ? i.modal.editTitleOrder : i.modal.newTitleOrder}</h2>
                <p className="text-sm text-neutral-700">{i.modal.subtitleOrder}</p>
              </div>
              <button
                aria-label="Fechar"
                className="grid size-9 place-items-center rounded-md text-lg text-neutral-800 hover:bg-neutral-100"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1">
                <span className="text-xs font-medium text-neutral-700">{i.modal.orderNameLabel}</span>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder={i.modal.orderNamePlaceholder}
                  className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-neutral-700">{i.modal.clientLabel}</span>
                <select
                  value={draft.clientId}
                  onChange={(e) => setDraft((d) => ({ ...d, clientId: e.target.value }))}
                  className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                >
                  <option value="">{i.modal.clientNone}</option>
                  {(clientsQ.data?.clients ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-neutral-700">{i.modal.orderedAtLabel}</span>
                  <input
                    type="datetime-local"
                    value={draft.orderedAt}
                    onChange={(e) => setDraft((d) => ({ ...d, orderedAt: e.target.value }))}
                    className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-neutral-700">{i.modal.deliveryAtLabel}</span>
                  <input
                    type="datetime-local"
                    value={draft.deliveryAt}
                    onChange={(e) => setDraft((d) => ({ ...d, deliveryAt: e.target.value }))}
                    className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-neutral-700">{i.modal.valueLabel}</span>
                  <input
                    value={draft.value}
                    onChange={(e) => setDraft((d) => ({ ...d, value: formatMoneyFromInput(e.target.value, moneyLocale) }))}
                    inputMode="numeric"
                    placeholder={i.modal.optional}
                    className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                  />
                </label>

                <label className="mt-6 flex items-center gap-2 text-sm text-neutral-800">
                  <input
                    type="checkbox"
                    checked={draft.delivered}
                    onChange={(e) => setDraft((d) => ({ ...d, delivered: e.target.checked }))}
                  />
                  {i.modal.deliveredLabel}
                </label>
              </div>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-neutral-700">{i.modal.observationsLabel}</span>
                <textarea
                  value={draft.observations}
                  onChange={(e) => setDraft((d) => ({ ...d, observations: e.target.value }))}
                  placeholder={i.modal.optional}
                  className="min-h-24 w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                />
              </label>

              <div className="mt-2 rounded-lg border border-theme p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium">{i.modal.itemsTitle}</div>
                  <button
                    type="button"
                    className="rounded-md border border-theme px-3 py-1.5 text-sm hover:bg-[var(--muted)]"
                    onClick={addItemLine}
                    disabled={productsQ.isLoading || (productsQ.data?.products?.length ?? 0) === 0}
                  >
                    {i.modal.addItem}
                  </button>
                </div>

                {draft.items.length === 0 ? (
                  <div className="mt-2 text-sm text-neutral-600">{i.modal.noItems}</div>
                ) : (
                  <div className="mt-3 grid gap-2">
                    {draft.items.map((it, idx) => (
                      <div key={idx} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px_80px] sm:items-center">
                        <select
                          value={it.productId}
                          onChange={(e) => updateItemLine(idx, { productId: e.target.value })}
                          className="w-full rounded-lg border border-theme bg-transparent px-3 py-2 text-sm"
                        >
                          {(productsQ.data?.products ?? []).map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.unit})
                            </option>
                          ))}
                        </select>

                        <input
                          value={it.quantity}
                          onChange={(e) => updateItemLine(idx, { quantity: e.target.value })}
                          className="w-full rounded-lg border border-theme bg-transparent px-3 py-2 text-sm"
                          placeholder={i.modal.quantityPlaceholder}
                        />

                        <button
                          type="button"
                          className="rounded-lg border border-theme px-3 py-2 text-sm text-[var(--danger)] hover:bg-[var(--danger-bg)]"
                          onClick={() => removeItemLine(idx)}
                        >
                          {i.modal.removeItem}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                className="rounded-lg border border-theme px-4 py-2 text-sm text-[var(--danger)] hover:bg-[var(--danger-bg)] disabled:opacity-50"
                onClick={remove}
                type="button"
                disabled={!draft.id || deleteM.isPending}
              >
                {i.modal.delete}
              </button>

              <div className="flex gap-2">
                <button
                  className="rounded-lg border border-theme px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)]"
                  onClick={() => setIsOpen(false)}
                  type="button"
                >
                  {i.modal.cancel}
                </button>
                <button
                  className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
                  onClick={save}
                  type="button"
                  disabled={!draft.name.trim() || createM.isPending || updateM.isPending}
                >
                  {i.modal.save}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
