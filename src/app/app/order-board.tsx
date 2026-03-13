'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Settings, X } from 'lucide-react'

import DataTable from './ui/data-table'
import SearchSelect from './ui/search-select'

import { useDraftStorage } from './use-draft-storage'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import FullCalendar from '@fullcalendar/react'
import type { DatesSetArg } from '@fullcalendar/core'
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
  status: 'DRAFT' | 'CONFIRMED' | 'IN_PRODUCTION' | 'READY' | 'SHIPPED' | 'DONE' | 'CANCELLED'
  orderIndex?: string | null
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

function formatMonthYear(d: Date, language: AppLanguage) {
  const locale = language === 'pt' ? 'pt-BR' : language === 'es' ? 'es-ES' : 'en-GB'
  // Example: "março de 2026" / "March 2026"
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(d)
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
  status: 'DRAFT' | 'CONFIRMED' | 'IN_PRODUCTION' | 'READY' | 'SHIPPED' | 'DONE' | 'CANCELLED'
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
    status: 'DRAFT',
    value: '',
    observations: '',
    items: [],
  }
}

const STATUS_ORDER: Order['status'][] = ['DRAFT', 'CONFIRMED', 'IN_PRODUCTION', 'READY', 'SHIPPED', 'DONE', 'CANCELLED']
const COLUMNS_STORAGE_KEY = 'orders:kanban:visibleStatuses:v1'

export default function OrderBoard() {
  const qc = useQueryClient()
  const { language, currency } = useSettings()
  const i = t(language)
  const moneyLocale = localeFromLanguage(language)

  const statusOrder = STATUS_ORDER
  const columnsStorageKey = COLUMNS_STORAGE_KEY

  function statusLabel(s: Order['status']) {
    if (language === 'pt') {
      if (s === 'DRAFT') return 'Rascunho'
      if (s === 'CONFIRMED') return 'Confirmado'
      if (s === 'IN_PRODUCTION') return 'Em produção'
      if (s === 'READY') return 'Pronto'
      if (s === 'SHIPPED') return 'Enviado'
      if (s === 'DONE') return 'Concluído'
      return 'Cancelado'
    }
    if (language === 'es') {
      if (s === 'DRAFT') return 'Borrador'
      if (s === 'CONFIRMED') return 'Confirmado'
      if (s === 'IN_PRODUCTION') return 'En producción'
      if (s === 'READY') return 'Listo'
      if (s === 'SHIPPED') return 'Enviado'
      if (s === 'DONE') return 'Hecho'
      return 'Cancelado'
    }
    // en
    if (s === 'DRAFT') return 'Draft'
    if (s === 'CONFIRMED') return 'Confirmed'
    if (s === 'IN_PRODUCTION') return 'In production'
    if (s === 'READY') return 'Ready'
    if (s === 'SHIPPED') return 'Shipped'
    if (s === 'DONE') return 'Done'
    return 'Cancelled'
  }

  function statusBadgeClass(s: Order['status']) {
    if (s === 'CONFIRMED') return 'bg-green-100 text-green-800'
    if (s === 'IN_PRODUCTION') return 'bg-amber-100 text-amber-800'
    if (s === 'READY') return 'bg-purple-100 text-purple-800'
    if (s === 'SHIPPED') return 'bg-cyan-100 text-cyan-800'
    if (s === 'DONE') return 'bg-emerald-100 text-emerald-800'
    if (s === 'CANCELLED') return 'bg-neutral-200 text-neutral-800'
    return 'bg-blue-100 text-blue-800'
  }

  function sortForKanban(a: Order, b: Order) {
    // Higher orderIndex first (most recent/top). Fallback to deliveryAt then created id.
    const ao = a.orderIndex ?? ''
    const bo = b.orderIndex ?? ''
    if (ao && bo && ao !== bo) return bo.localeCompare(ao)
    if (ao && !bo) return -1
    if (!ao && bo) return 1

    const ad = a.deliveryAt ?? ''
    const bd = b.deliveryAt ?? ''
    if (ad !== bd) return ad.localeCompare(bd)
    return a.id.localeCompare(b.id)
  }

  async function setOrderStatus(orderId: string, nextStatus: Order['status']) {
    await updateM.mutateAsync({ id: orderId, payload: { status: nextStatus } })
  }

  async function bumpOrder(orderId: string, nextStatus: Order['status']) {
    // Move card to top of the target column
    // eslint-disable-next-line react-hooks/purity
    await updateM.mutateAsync({ id: orderId, payload: { status: nextStatus, orderIndex: String(Date.now()) } })
  }

  function onDragStart(e: React.DragEvent, o: Order) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/orderId', o.id)
    e.dataTransfer.setData('text/fromStatus', o.status)
  }

  async function onDropColumn(e: React.DragEvent, st: Order['status']) {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/orderId')
    if (!id) return
    await bumpOrder(id, st)
  }

  const [isOpen, setIsOpen] = useState(false)
  const [calendarFullscreen, setCalendarFullscreen] = useState(false)
  const [mode, setMode] = useState<'list' | 'kanban'>('list')
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [listQuery, setListQuery] = useState('')
  const defaultVisibleStatuses = useMemo(() => STATUS_ORDER.filter((s) => s !== 'CANCELLED'), [])
  const [visibleStatuses, setVisibleStatuses] = useState<Order['status'][]>(() => defaultVisibleStatuses)

  const calRef = useRef<FullCalendar | null>(null)
  const calModalRef = useRef<FullCalendar | null>(null)
  const [calTitle, setCalTitle] = useState('')
  const [calModalTitle, setCalModalTitle] = useState('')

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
    queryKey: ['orders'],
    queryFn: () => api<{ orders: Order[] }>(`/api/orders?view=all`),
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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(columnsStorageKey)
      if (!raw) return
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) return
      const allowed = new Set(STATUS_ORDER)
      const next = parsed.filter((s) => typeof s === 'string' && allowed.has(s as any)) as Order['status'][]
      if (next.length) setVisibleStatuses(next)
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(columnsStorageKey, JSON.stringify(visibleStatuses))
    } catch {
      // ignore
    }
  }, [columnsStorageKey, visibleStatuses])

  const listFiltered = useMemo(() => {
    const q = listQuery.trim().toLowerCase()
    if (!q) return orders
    return orders.filter((o) => {
      if (o.name.toLowerCase().includes(q)) return true
      if (o.client?.name && o.client.name.toLowerCase().includes(q)) return true
      return false
    })
  }, [orders, listQuery])

  const sorted = useMemo(() => {
    const items = [...listFiltered]
    items.sort((a, b) => {
      const ad = a.deliveryAt ?? '9999-12-31'
      const bd = b.deliveryAt ?? '9999-12-31'
      return ad.localeCompare(bd)
    })
    return items
  }, [listFiltered])

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
      status: o.status,
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
      status: draft.status,
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
    return (listFiltered ?? [])
      .filter((o) => !!o.deliveryAt)
      .map((o) => {
        const cancelled = o.status === 'CANCELLED'
        const done = o.status === 'DONE'
        const confirmed = o.status === 'CONFIRMED'
        const inProd = o.status === 'IN_PRODUCTION'
        const ready = o.status === 'READY'
        const shipped = o.status === 'SHIPPED'
        return {
          id: o.id,
          title: o.client?.name ? `${o.name} — ${o.client.name}` : o.name,
          start: toLocalDateOnly(o.deliveryAt as string),
          allDay: true,
          backgroundColor: cancelled
            ? '#6b7280'
            : done
              ? '#059669'
              : shipped
                ? '#0891b2'
                : ready
                  ? '#7c3aed'
                  : inProd
                    ? '#d97706'
                    : confirmed
                      ? '#16a34a'
                      : '#2563eb',
          borderColor: cancelled
            ? '#4b5563'
            : done
              ? '#047857'
              : shipped
                ? '#0e7490'
                : ready
                  ? '#6d28d9'
                  : inProd
                    ? '#b45309'
                    : confirmed
                      ? '#15803d'
                      : '#1d4ed8',
          textColor: '#ffffff',
        }
      })
  }, [listFiltered])

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{i.orders.title}</h1>
          <p className="text-sm text-neutral-600">{i.orders.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={
                'rounded-lg border border-theme px-3 py-2 text-sm font-medium ' +
                (mode === 'kanban' ? 'bg-[var(--muted)] text-[var(--foreground)]' : 'bg-transparent text-[var(--foreground)]')
              }
              onClick={() => setMode('kanban')}
            >
              {language === 'pt' ? 'Quadro' : language === 'es' ? 'Tablero' : 'Board'}
            </button>
            <button
              type="button"
              className={
                'rounded-lg border border-theme px-3 py-2 text-sm font-medium ' +
                (mode === 'list' ? 'bg-[var(--muted)] text-[var(--foreground)]' : 'bg-transparent text-[var(--foreground)]')
              }
              onClick={() => setMode('list')}
            >
              {language === 'pt' ? 'Lista' : language === 'es' ? 'Lista' : 'List'}
            </button>

            <button
              className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90"
              onClick={openCreate}
              type="button"
            >
              {i.orders.new}
            </button>
        </div>
      </header>

      {columnsOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label={language === 'pt' ? 'Fechar' : language === 'es' ? 'Cerrar' : 'Close'}
            onClick={() => setColumnsOpen(false)}
          />
          <div className="surface absolute left-3 right-3 top-24 mx-auto w-full max-w-md rounded-2xl border border-theme p-4 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-[var(--foreground)]">
                  {language === 'pt' ? 'Colunas do quadro' : language === 'es' ? 'Columnas del tablero' : 'Board columns'}
                </h2>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  {language === 'pt'
                    ? 'Escolha quais estados aparecem no quadro. (Cancelado vem oculto por padrão)'
                    : language === 'es'
                      ? 'Elige qué estados aparecen en el tablero. (Cancelado viene oculto por defecto)'
                      : 'Choose which statuses appear on the board. (Cancelled is hidden by default)'}
                </p>
              </div>
              <button
                type="button"
                className="grid size-9 place-items-center rounded-md text-lg text-[var(--foreground)] hover:bg-[var(--muted)]"
                aria-label={language === 'pt' ? 'Fechar' : language === 'es' ? 'Cerrar' : 'Close'}
                onClick={() => setColumnsOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="mt-4 grid gap-2">
              {statusOrder.map((st) => {
                const checked = visibleStatuses.includes(st)
                return (
                  <label key={st} className="flex items-center justify-between gap-3 rounded-lg border border-theme px-3 py-2">
                    <span className="text-sm text-[var(--foreground)]">{statusLabel(st)}</span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const on = e.target.checked
                        setVisibleStatuses((prev) => {
                          const set = new Set(prev)
                          if (on) set.add(st)
                          else set.delete(st)
                          const next = statusOrder.filter((s) => set.has(s))
                          return next.length ? next : prev
                        })
                      }}
                    />
                  </label>
                )
              })}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg border border-theme px-3 py-2 text-sm font-medium hover:bg-[var(--muted)]"
                onClick={() => setVisibleStatuses(defaultVisibleStatuses)}
              >
                {language === 'pt' ? 'Restaurar padrão' : language === 'es' ? 'Restaurar por defecto' : 'Reset default'}
              </button>
              <button
                type="button"
                className="rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90"
                onClick={() => setColumnsOpen(false)}
              >
                {language === 'pt' ? 'Ok' : language === 'es' ? 'Ok' : 'Ok'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {ordersQ.isLoading ? (
        <p className="text-sm text-neutral-600">Carregando…</p>
      ) : ordersQ.isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Erro ao carregar: {String(ordersQ.error)}
        </div>
      ) : (
        mode === 'kanban' ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                value={listQuery}
                onChange={(e) => setListQuery(e.target.value)}
                placeholder={language === 'pt' ? 'Buscar pedido ou cliente…' : language === 'es' ? 'Buscar pedido o cliente…' : 'Search order or client…'}
                className="w-full rounded-lg border border-theme bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
              />
              <button
                type="button"
                className="grid size-10 shrink-0 place-items-center rounded-lg border border-theme text-[var(--foreground)] hover:bg-[var(--muted)]"
                onClick={() => setColumnsOpen(true)}
                aria-label={language === 'pt' ? 'Colunas' : language === 'es' ? 'Columnas' : 'Columns'}
                title={language === 'pt' ? 'Colunas' : language === 'es' ? 'Columnas' : 'Columns'}
              >
                <Settings className="size-4" />
              </button>
            </div>

            <div className="hidden text-xs text-[var(--muted-foreground)] lg:block">
              {language === 'pt'
                ? 'Dica: arraste os pedidos entre colunas. As colunas encaixam na tela em modo desktop.'
                : language === 'es'
                  ? 'Consejo: arrastra los pedidos entre columnas. Las columnas encajan en pantalla en escritorio.'
                  : 'Tip: drag orders between columns. Columns fit on screen on desktop.'}
            </div>

            <div className="overflow-x-auto pb-2">
              <div className="grid w-max min-w-full grid-flow-col auto-cols-[minmax(240px,1fr)] gap-2">
                {statusOrder.filter((st) => visibleStatuses.includes(st)).map((st) => {
                const col = orders.filter((o) => o.status === st).sort(sortForKanban)
                return (
                  <div
                    key={st}
                    className="min-w-0 rounded-xl border border-theme bg-[var(--surface)]/40 p-2"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => void onDropColumn(e, st)}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="truncate text-xs font-semibold text-[var(--foreground)]">{statusLabel(st)}</div>
                      <div className="text-[10px] text-[var(--muted-foreground)]">{col.length}</div>
                    </div>

                    <div className="grid gap-2">
                      {col.map((o) => {
                        return (
                          <button
                            key={o.id}
                            type="button"
                            draggable
                            onDragStart={(e) => onDragStart(e, o)}
                            onClick={() => openEdit(o)}
                            className="surface block w-full rounded-lg border border-theme p-2 text-left hover:bg-[var(--muted)]"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-[var(--foreground)]">{o.name}</div>
                              <div className="mt-1 truncate text-xs text-[var(--muted-foreground)]">{o.client?.name ?? i.orders.noClient}</div>
                            </div>
                          </button>
                        )
                      })}

                      {col.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-theme p-3 text-xs text-[var(--muted-foreground)]">
                          {language === 'pt' ? 'Sem pedidos.' : language === 'es' ? 'Sin pedidos.' : 'No orders.'}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                value={listQuery}
                onChange={(e) => setListQuery(e.target.value)}
                placeholder={language === 'pt' ? 'Buscar pedido ou cliente…' : language === 'es' ? 'Buscar pedido o cliente…' : 'Search order or client…'}
                className="w-full rounded-lg border border-theme bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
              />
            </div>

            <DataTable
              rows={sorted}
              empty={i.orders.empty}
              labels={i.table}
              showSearch={false}
              initialSort={{ key: 'deliveryAt', dir: 'asc' }}
              onRowClick={openEdit}
              columns={[
                {
                  key: 'name',
                  header: language === 'pt' ? 'Pedido' : language === 'es' ? 'Pedido' : 'Order',
                  sortValue: (r) => r.name,
                  searchValue: (r) => r.name,
                  render: (r) => (
                    <div className="font-medium text-[var(--foreground)]">
                      {r.name}
                      <span className={'ml-2 rounded-full px-2 py-0.5 text-xs ' + statusBadgeClass(r.status)}>
                        {statusLabel(r.status)}
                      </span>
                    </div>
                  ),
                },
                {
                  key: 'client',
                  header: i.orders.client,
                  sortValue: (r) => r.client?.name ?? '',
                  searchValue: (r) => r.client?.name ?? '',
                  render: (r) => (
                    <div className="text-[var(--muted-foreground)]">{r.client?.name ?? i.orders.noClient}</div>
                  ),
                },
                {
                  key: 'value',
                  header: i.orders.value,
                  sortValue: (r) => (r.value == null ? -1 : Number(r.value)),
                  searchValue: (r) => (r.value == null ? '' : String(r.value)),
                  render: (r) => (
                    <div className="text-[var(--muted-foreground)]">
                      {r.value == null ? '—' : formatMoneyDisplay(r.value, moneyLocale, currency)}
                    </div>
                  ),
                },
                {
                  key: 'deliveryAt',
                  header: i.orders.deliveryAt,
                  sortValue: (r) => (r.deliveryAt ? new Date(r.deliveryAt) : new Date(0)),
                  searchValue: (r) => (r.deliveryAt ? new Date(r.deliveryAt).toLocaleDateString() : ''),
                  render: (r) => (
                    <div className="text-[var(--muted-foreground)]">
                      {r.deliveryAt ? new Date(r.deliveryAt).toLocaleDateString() : i.orders.noDeliveryAt}
                    </div>
                  ),
                },
              ]}
            />
          </section>

          <section className="surface rounded-xl border border-theme p-2 sm:p-3">
            <div className="mb-2 flex items-center justify-between gap-2 px-1">
              <button
                type="button"
                className="rounded-md border border-theme bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--foreground)] hover:bg-[var(--muted)]"
                onClick={() => calRef.current?.getApi().today()}
              >
                {i.calendar.today}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="grid size-8 place-items-center rounded-md border border-theme bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--muted)]"
                  aria-label="Mês anterior"
                  onClick={() => calRef.current?.getApi().prev()}
                >
                  <ChevronLeft className="size-4" />
                </button>

                <div className="w-44 sm:w-56 text-center text-sm font-semibold capitalize text-[var(--foreground)]">
                  {calTitle}
                </div>

                <button
                  type="button"
                  className="grid size-8 place-items-center rounded-md border border-theme bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--muted)]"
                  aria-label="Próximo mês"
                  onClick={() => calRef.current?.getApi().next()}
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>

              <button
                type="button"
                className="grid size-9 place-items-center rounded-md border border-theme bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--muted)]"
                aria-label="Ampliar calendário"
                title="Ampliar calendário"
                onClick={() => setCalendarFullscreen(true)}
              >
                <Maximize2 className="size-4" />
              </button>
            </div>

            <FullCalendar
              ref={calRef}
              plugins={[dayGridPlugin, interactionPlugin]}
              locale={calendarLocale(language)}
              headerToolbar={false}
              datesSet={(arg: DatesSetArg) => setCalTitle(formatMonthYear(arg.view.currentStart, language))}
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
      ))}

      {calendarFullscreen ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Fechar calendário"
            onClick={() => setCalendarFullscreen(false)}
          />

          <div className="surface absolute left-3 right-3 top-3 mx-auto flex h-[92vh] max-w-6xl flex-col overflow-hidden rounded-2xl border border-theme shadow-xl sm:left-6 sm:right-6 sm:top-6">
            <div className="flex items-center justify-between gap-3 border-b border-theme px-4 py-3">
              <button
                type="button"
                className="rounded-md border border-theme bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--foreground)] hover:bg-[var(--muted)]"
                onClick={() => calModalRef.current?.getApi().today()}
              >
                {i.calendar.today}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="grid size-8 place-items-center rounded-md border border-theme bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--muted)]"
                  aria-label="Mês anterior"
                  onClick={() => calModalRef.current?.getApi().prev()}
                >
                  <ChevronLeft className="size-4" />
                </button>

                <div className="w-44 sm:w-56 text-center text-sm font-semibold capitalize text-[var(--foreground)]">
                  {calModalTitle}
                </div>

                <button
                  type="button"
                  className="grid size-8 place-items-center rounded-md border border-theme bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--muted)]"
                  aria-label="Próximo mês"
                  onClick={() => calModalRef.current?.getApi().next()}
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>

              <button
                type="button"
                className="grid size-9 place-items-center rounded-md border border-theme bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--muted)]"
                onClick={() => setCalendarFullscreen(false)}
                aria-label="Fechar"
                title="Fechar"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 p-3 sm:p-4">
              <FullCalendar
                ref={calModalRef}
                plugins={[dayGridPlugin, interactionPlugin]}
                locale={calendarLocale(language)}
                headerToolbar={false}
                datesSet={(arg: DatesSetArg) => setCalModalTitle(formatMonthYear(arg.view.currentStart, language))}
                initialView="dayGridMonth"
                height="100%"
                events={calendarEvents}
                eventClick={(info) => {
                  const found = (ordersQ.data?.orders ?? []).find((o) => o.id === info.event.id)
                  if (found) openEdit(found)
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {isOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsOpen(false)} />
          <div className="surface absolute bottom-0 left-0 right-0 mx-auto w-full max-w-2xl rounded-t-2xl border border-theme p-5 shadow-xl sm:bottom-auto sm:top-20 sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{draft.id ? i.modal.editTitleOrder : i.modal.newTitleOrder}</h2>
                <p className="text-sm text-[var(--text-muted)]">{i.modal.subtitleOrder}</p>
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
              <label className="grid gap-1">
                <span className="text-xs font-medium text-[var(--foreground)]">{i.modal.orderNameLabel}</span>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder={i.modal.orderNamePlaceholder}
                  className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-[var(--foreground)]">{i.modal.clientLabel}</span>

                <SearchSelect
                  value={
                    draft.clientId
                      ? (() => {
                          const found = (clientsQ.data?.clients ?? []).find((c) => c.id === draft.clientId)
                          return found ? { id: found.id, label: found.name } : { id: draft.clientId, label: '—' }
                        })()
                      : null
                  }
                  onChange={(next) => setDraft((d) => ({ ...d, clientId: next?.id ?? '' }))}
                  minChars={2}
                  labels={{
                    placeholder: i.modal.clientNone,
                    hint: language === 'pt' ? 'Digite pelo menos 2 letras…' : language === 'es' ? 'Escribe 2+ letras…' : 'Type at least 2 letters…',
                    loading: language === 'pt' ? 'Buscando…' : language === 'es' ? 'Buscando…' : 'Searching…',
                    empty: language === 'pt' ? 'Nenhum cliente encontrado.' : language === 'es' ? 'No se encontraron clientes.' : 'No clients found.',
                  }}
                  fetcher={async (q) => {
                    const res = await fetch(`/api/clients?q=${encodeURIComponent(q)}`)
                    if (!res.ok) throw new Error(await res.text())
                    const data = (await res.json()) as { clients: Array<{ id: string; name: string }> }
                    return (data.clients ?? []).map((c) => ({ id: c.id, label: c.name }))
                  }}
                />
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-[var(--foreground)]">{i.modal.orderedAtLabel}</span>
                  <input
                    type="datetime-local"
                    value={draft.orderedAt}
                    onChange={(e) => setDraft((d) => ({ ...d, orderedAt: e.target.value }))}
                    className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-[var(--foreground)]">{i.modal.deliveryAtLabel}</span>
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
                  <span className="text-xs font-medium text-[var(--foreground)]">{i.modal.valueLabel}</span>
                  <input
                    value={draft.value}
                    onChange={(e) => setDraft((d) => ({ ...d, value: formatMoneyFromInput(e.target.value, moneyLocale) }))}
                    inputMode="numeric"
                    placeholder={i.modal.optional}
                    className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-medium text-[var(--foreground)]">{i.modal.statusLabel}</span>
                  <select
                    value={draft.status}
                    onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as Draft['status'] }))}
                    className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                  >
                    <option value="DRAFT">{statusLabel('DRAFT')}</option>
                    <option value="CONFIRMED">{statusLabel('CONFIRMED')}</option>
                    <option value="IN_PRODUCTION">{statusLabel('IN_PRODUCTION')}</option>
                    <option value="READY">{statusLabel('READY')}</option>
                    <option value="SHIPPED">{statusLabel('SHIPPED')}</option>
                    <option value="DONE">{statusLabel('DONE')}</option>
                    <option value="CANCELLED">{statusLabel('CANCELLED')}</option>
                  </select>
                </label>
              </div>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-[var(--foreground)]">{i.modal.observationsLabel}</span>
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
