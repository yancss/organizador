'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Settings, X } from 'lucide-react'

import DataTable from './ui/data-table'
import SearchSelect from './ui/search-select'
import FieldLabel from './ui/field-label'

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

function clampPercent(p: number) {
  if (!Number.isFinite(p)) return 0
  return Math.max(0, Math.min(100, p))
}

function calcDraftTotals(draft: {
  discountMode: 'SUBTOTAL' | 'PER_ITEM'
  discountType: 'VALUE' | 'PERCENT'
  discountValue: string
  discountPercent: string
  items: Array<{
    quantity: string
    unitPrice: string
    discountType?: 'VALUE' | 'PERCENT' | null
    discountValue?: string
    discountPercent?: string
  }>
}, moneyLocale: string) {
  const lines = (draft.items ?? []).map((it) => {
    const qty = Number(String(it.quantity ?? '').replace(',', '.'))
    const unit = it.unitPrice?.trim() ? (parseMoneyToNumber(it.unitPrice, moneyLocale) ?? 0) : 0
    const subtotal = (Number.isFinite(qty) ? Math.max(0, qty) : 0) * Math.max(0, unit)

    let discount = 0
    if (draft.discountMode === 'PER_ITEM') {
      // Priority: fixed value discount (R$) > percent discount
      const dv = it.discountValue?.trim() ? Math.max(0, parseMoneyToNumber(it.discountValue, moneyLocale) ?? 0) : 0
      if (dv > 0) {
        discount = dv
      } else {
        const p = clampPercent(Number(String(it.discountPercent ?? '').replace(',', '.')))
        discount = (subtotal * p) / 100
      }

      // Do not allow discount to zero the item (strictly less than subtotal)
      if (subtotal > 0) discount = Math.min(Math.max(0, subtotal - 0.01), Math.max(0, discount))
      else discount = 0
    }

    const total = Math.max(0, subtotal - discount)
    return { subtotal, discount, total }
  })

  const subtotal = lines.reduce((a, b) => a + b.subtotal, 0)

  let discount = 0
  if (draft.discountMode === 'SUBTOTAL') {
    if (draft.discountType === 'PERCENT') {
      const p = clampPercent(Number(String(draft.discountPercent ?? '').replace(',', '.')))
      discount = (subtotal * p) / 100
    } else {
      discount = draft.discountValue?.trim() ? Math.max(0, parseMoneyToNumber(draft.discountValue, moneyLocale) ?? 0) : 0
    }
    discount = Math.min(subtotal, discount)
  } else {
    discount = lines.reduce((a, b) => a + b.discount, 0)
  }

  const total = Math.max(0, subtotal - discount)
  return { subtotal, discount, total }
}

import { useSettings, type AppLanguage } from './settings-context'
import { api } from './api-client'
import { toast, toastCreated, toastUpdated, toastDeleted, toastFailedToSave, toastFailedToDelete } from './toast'

type Client = { id: string; name: string }

type Product = { id: string; name: string; unit: string }

type DiscountType = 'VALUE' | 'PERCENT'

type OrderItem = {
  productId: string
  quantity: string // input
  unitPrice: string // money input
  // input unit for quantity + unit price (user can type in kg even if product is gr)
  unit?: string
  discountType?: DiscountType | null
  discountValue?: string // money input
  discountPercent?: string // percent input
}

type Order = {
  id: string
  code?: string | null
  name: string
  observations: string | null
  orderedAt: string | null
  deliveryAt: string | null
  status: 'DRAFT' | 'CONFIRMED' | 'IN_PRODUCTION' | 'READY' | 'SHIPPED' | 'DONE' | 'CANCELLED'
  orderIndex?: string | null
  value: string | number | null

  discountMode?: 'SUBTOTAL' | 'PER_ITEM'
  discountType?: DiscountType | null
  discountValue?: string | number | null
  discountPercent?: string | number | null

  client: Client | null
  items: Array<{
    id: string
    quantity: string | number
    unitPrice?: string | number
    discountType?: DiscountType | null
    discountValue?: string | number | null
    discountPercent?: string | number | null
    product: Product
  }>
}

// (moved to api-client.ts)


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

function supportsBarcodeDetector() {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window
}

function BarcodeScanModal({
  language,
  onClose,
  onScanned,
}: {
  language: string
  onClose: () => void
  onScanned: (payload: { code: string; qty: number }) => void
}) {
  const [code, setCode] = useState('')
  const [qty, setQty] = useState(1)
  const [err, setErr] = useState<string | null>(null)

  const [cameraOn, setCameraOn] = useState(false)
  const [cameraErr, setCameraErr] = useState<string | null>(null)

  useEffect(() => {
    if (!cameraOn) return
    if (!supportsBarcodeDetector()) {
      setCameraErr(language === 'pt' ? 'Scanner não suportado neste navegador.' : 'Scanner not supported in this browser.')
      return
    }

    let stream: MediaStream | null = null
    let raf = 0
    const video = document.getElementById('ean-video-so') as HTMLVideoElement | null

    const run = async () => {
      try {
        setCameraErr(null)
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (!video) return
        video.srcObject = stream
        await video.play()

        // @ts-expect-error - BarcodeDetector is a web API
        const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'] })

        const tick = async () => {
          try {
            if (!video || video.readyState < 2) {
              raf = requestAnimationFrame(tick)
              return
            }
            const barcodes = await detector.detect(video)
            const v = (barcodes?.[0]?.rawValue ?? '') as string
            if (v) {
              setCode(v)
              setCameraOn(false)
              onScanned({ code: v, qty })
              return
            }
          } catch {
            // ignore
          }
          raf = requestAnimationFrame(tick)
        }

        raf = requestAnimationFrame(tick)
      } catch (e: any) {
        setCameraErr(String(e?.message ?? e))
      }
    }

    void run()

    return () => {
      if (raf) cancelAnimationFrame(raf)
      if (stream) stream.getTracks().forEach((t) => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOn])

  function submit() {
    const c = code.trim().replace(/\s+/g, '')
    if (!c) {
      setErr(language === 'pt' ? 'Informe o código.' : 'Enter a code.')
      return
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setErr(language === 'pt' ? 'Quantidade inválida.' : 'Invalid quantity.')
      return
    }

    setErr(null)
    onScanned({ code: c, qty })
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="surface modal-safe absolute bottom-0 left-0 right-0 mx-auto w-full max-w-lg rounded-t-2xl border border-theme p-5 shadow-xl sm:bottom-auto sm:top-24 sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{language === 'pt' ? 'Escanear EAN' : language === 'es' ? 'Escanear EAN' : 'Scan'}</h2>
            <p className="text-sm text-[var(--text-muted)]">
              {language === 'pt'
                ? 'Use a câmera (se disponível) ou digite o código.'
                : language === 'es'
                  ? 'Usa la cámara (si está disponible) o escribe el código.'
                  : 'Use camera (if available) or type the code.'}
            </p>
          </div>
          <button type="button" className="btn btn-secondary btn-icon" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1">
              <span className="text-xs font-medium text-[var(--foreground)]">{language === 'pt' ? 'Código' : language === 'es' ? 'Código' : 'Code'}</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                placeholder={language === 'pt' ? 'EAN' : 'EAN'}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-medium text-[var(--foreground)]">{language === 'pt' ? 'Qtd.' : language === 'es' ? 'Cant.' : 'Qty'}</span>
              <input
                value={String(qty)}
                onChange={(e) => setQty(Number(e.target.value.replace(',', '.')))}
                className="w-full rounded-lg border border-theme bg-transparent px-3 py-2 tabular-nums text-right"
                inputMode="decimal"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => setCameraOn((v) => !v)}>
              {cameraOn
                ? language === 'pt'
                  ? 'Desligar câmera'
                  : language === 'es'
                    ? 'Apagar cámara'
                    : 'Stop camera'
                : language === 'pt'
                  ? 'Usar câmera'
                  : language === 'es'
                    ? 'Usar cámara'
                    : 'Use camera'}
            </button>
            <button type="button" className="btn btn-primary" onClick={submit}>
              {language === 'pt' ? 'Adicionar' : language === 'es' ? 'Agregar' : 'Add'}
            </button>
          </div>

          {cameraOn ? (
            <div className="rounded-xl border border-theme p-2">
              <video id="ean-video-so" className="h-56 w-full rounded-lg bg-black" playsInline muted />
              {cameraErr ? <div className="mt-2 text-xs text-[var(--danger)]">{cameraErr}</div> : null}
            </div>
          ) : null}

          {err ? <div className="text-sm text-[var(--danger)]">{err}</div> : null}
        </div>
      </div>
    </div>
  )
}

type Draft = {
  id?: string
  name: string
  clientId: string
  orderedAt: string
  deliveryAt: string
  status: 'DRAFT' | 'CONFIRMED' | 'IN_PRODUCTION' | 'READY' | 'SHIPPED' | 'DONE' | 'CANCELLED'

  discountMode: 'SUBTOTAL' | 'PER_ITEM'
  discountType: DiscountType
  discountValue: string
  discountPercent: string

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

    discountMode: 'SUBTOTAL',
    discountType: 'VALUE',
    discountValue: '',
    discountPercent: '',

    observations: '',
    items: [],
  }
}

const STATUS_ORDER: Order['status'][] = ['DRAFT', 'CONFIRMED', 'IN_PRODUCTION', 'READY', 'SHIPPED', 'DONE', 'CANCELLED']
const COLUMNS_STORAGE_KEY = 'orders:kanban:visibleStatuses:v1'

export default function OrderBoard() {
  const router = useRouter()
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

  const [scanOpen, setScanOpen] = useState(false)

  // Operational filters (server-side; exports reuse them)
  const [view, setView] = useState<'upcoming' | 'history' | 'all'>('upcoming')
  const [createdByMe, setCreatedByMe] = useState(false)
  const [ownerMe, setOwnerMe] = useState(false)
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [statusFilter, setStatusFilter] = useState<Order['status'][]>([])

  const defaultVisibleStatuses = useMemo(() => STATUS_ORDER.filter((s) => s !== 'CANCELLED'), [])
  const [visibleStatuses, setVisibleStatuses] = useState<Order['status'][]>(() => defaultVisibleStatuses)

  const calRef = useRef<FullCalendar | null>(null)
  const calModalRef = useRef<FullCalendar | null>(null)
  const didAutoOpenEditRef = useRef(false)
  const [calTitle, setCalTitle] = useState('')
  const [calModalTitle, setCalModalTitle] = useState('')

  const draftStore = useDraftStorage<Draft>('draft:orders', emptyDraft)
  const draft = draftStore.value
  const setDraft = draftStore.setValue

  const liveTotals = useMemo(() => calcDraftTotals(draft, moneyLocale), [draft, moneyLocale])

  const hasAnyItemDiscount = useMemo(() => {
    return (draft.items ?? []).some((it) => {
      const dv = it.discountValue?.trim() ? (parseMoneyToNumber(it.discountValue, moneyLocale) ?? 0) : 0
      const dp = it.discountPercent?.trim() ? Number(String(it.discountPercent).replace(',', '.')) : 0
      return (Number.isFinite(dv) && dv > 0) || (Number.isFinite(dp) && dp > 0)
    })
  }, [draft.items, moneyLocale])

  const productsQ = useQuery({
    queryKey: ['products', 'FINISHED'],
    queryFn: () => api<{ products: Product[] }>('/api/products?kind=FINISHED'),
  })

  const clientsQ = useQuery({
    queryKey: ['clients'],
    queryFn: () => api<{ clients: Client[] }>('/api/clients'),
  })

  const ordersParams = useMemo(() => {
    const p = new URLSearchParams()
    p.set('view', view)

    const q = listQuery.trim()
    if (q) p.set('q', q)

    if (createdByMe) p.set('createdBy', 'me')
    if (ownerMe) p.set('owner', 'me')
    if (overdueOnly) p.set('overdue', '1')

    for (const st of statusFilter) p.append('status', st)

    return p
  }, [view, listQuery, createdByMe, ownerMe, overdueOnly, statusFilter])

  const ordersQ = useQuery({
    queryKey: ['orders', ordersParams.toString()],
    queryFn: () => api<{ orders: Order[] }>(`/api/orders?${ordersParams.toString()}`),
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

  const scanM = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { code: string; qty: number } }) =>
      api<any>(`/api/orders/${id}/scan`, { method: 'POST', body: JSON.stringify(payload) }),
    onError: (e: any) => toastFailedToSave(i, String(e?.message ?? e ?? '')),
  })

  const orders = ordersQ.data?.orders ?? []

  // If user comes from the details page clicking "Editar", open the modal automatically.
  useEffect(() => {
    if (didAutoOpenEditRef.current) return
    if (!orders.length) return

    const p = new URLSearchParams(window.location.search)
    const editId = p.get('edit')
    if (!editId) return

    const found = orders.find((o) => o.id === editId)
    if (!found) return

    didAutoOpenEditRef.current = true
    openEdit(found)

    // cleanup param to avoid reopening on refresh
    p.delete('edit')
    const next = window.location.pathname + (p.toString() ? `?${p.toString()}` : '')
    window.history.replaceState({}, '', next)
  }, [orders])

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

  // Server-side filtering (ordersParams) already applies. Keep a tiny client-side fallback for safety.
  const listFiltered = useMemo(() => {
    const q = listQuery.trim().toLowerCase()
    if (!q) return orders
    return orders.filter((o) => {
      if ((o.code ?? '').toLowerCase().includes(q)) return true
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

      discountMode: o.discountMode ?? 'SUBTOTAL',
      discountType: (o.discountType as any) ?? 'VALUE',
      discountValue: o.discountValue == null ? '' : formatMoneyFromNumber(Number(o.discountValue), moneyLocale),
      discountPercent: o.discountPercent == null ? '' : String(o.discountPercent),

      observations: o.observations ?? '',
      items: o.items.map((it) => ({
        productId: it.product.id,
        quantity: String(it.quantity),
        unitPrice: it.unitPrice == null ? '' : formatMoneyFromNumber(Number(it.unitPrice), moneyLocale),
        unit: it.product?.unit,
        discountType: (it.discountType as any) ?? null,
        discountValue: it.discountValue == null ? '' : formatMoneyFromNumber(Number(it.discountValue), moneyLocale),
        discountPercent: it.discountPercent == null ? '' : String(it.discountPercent),
      })),
    })
    setIsOpen(true)
  }

  function openDetails(o: Order) {
    router.push(`/app/sales/orders/${o.id}`)
  }

  function addItemLine() {
    const products = productsQ.data?.products ?? []
    const used = new Set(draft.items.map((it) => it.productId))
    const firstAvailableId = products.find((p) => !used.has(p.id))?.id ?? products[0]?.id ?? ''
    const p0 = products.find((p) => p.id === firstAvailableId) ?? products[0]

    setDraft((d) => ({
      ...d,
      items: [
        ...d.items,
        {
          productId: firstAvailableId,
          quantity: '1',
          unitPrice: '',
          unit: p0?.unit,
          discountType: null,
          discountValue: '',
          discountPercent: '',
        },
      ],
    }))
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

    if (!draft.clientId) {
      toastFailedToSave(i, language === 'pt' ? 'Selecione um cliente.' : language === 'es' ? 'Selecciona un cliente.' : 'Select a client.')
      return
    }

    const items = draft.items
      .filter((it) => it.productId && it.quantity.trim())
      .map((it) => {
        const quantity = Number(it.quantity.replace(',', '.'))
        const unitPrice = it.unitPrice.trim() ? (parseMoneyToNumber(it.unitPrice, moneyLocale) ?? 0) : 0

        // Per-item discount: allow both inputs, but persist one (priority: value > percent)
        const dv = it.discountValue?.trim() ? Math.max(0, parseMoneyToNumber(it.discountValue, moneyLocale) ?? 0) : 0
        const dp = it.discountPercent?.trim() ? clampPercent(Number(it.discountPercent.replace(',', '.'))) : 0

        let discountType: DiscountType | null = null
        let discountValue: number | null = null
        let discountPercent: number | null = null

        if (draft.discountMode === 'PER_ITEM') {
          if (dv > 0) {
            discountType = 'VALUE'
            discountValue = dv
          } else if (dp > 0) {
            discountType = 'PERCENT'
            discountPercent = dp
          }
        }

        return {
          productId: it.productId,
          quantity,
          unitPrice,
          unit: it.unit ?? null,
          discountType,
          discountValue,
          discountPercent,
        }
      })
      .filter((it) => Number.isFinite(it.quantity) && it.quantity > 0)

    if (!items.length) {
      toastFailedToSave(i, language === 'pt' ? 'Adicione pelo menos 1 item.' : language === 'es' ? 'Agrega al menos 1 ítem.' : 'Add at least 1 item.')
      return
    }

    // Validate per-item discount constraints: no negative and cannot zero the line
    if (draft.discountMode === 'PER_ITEM') {
      for (const it of items) {
        const subtotal = Math.max(0, Number(it.quantity) * Math.max(0, Number(it.unitPrice ?? 0)))
        let disc = 0

        if (it.discountType === 'VALUE') disc = Math.max(0, Number(it.discountValue ?? 0))
        else if (it.discountType === 'PERCENT') disc = (subtotal * clampPercent(Number(it.discountPercent ?? 0))) / 100

        if (disc < 0) {
          toastFailedToSave(i, language === 'pt' ? 'Desconto negativo não é permitido.' : language === 'es' ? 'No se permite descuento negativo.' : 'Negative discount is not allowed.')
          return
        }

        if (subtotal > 0 && disc >= subtotal) {
          toastFailedToSave(
            i,
            language === 'pt'
              ? 'O desconto do item não pode zerar o valor do item (precisa ser menor que o subtotal do item).'
              : language === 'es'
                ? 'El descuento del ítem no puede dejar el valor en cero (debe ser menor que el subtotal del ítem).'
                : 'Item discount cannot zero the line (must be less than the line subtotal).',
          )
          return
        }
      }
    }

    const payload = {
      name,
      observations: draft.observations.trim() ? draft.observations : null,
      clientId: draft.clientId,
      orderedAt: fromLocalInputValue(draft.orderedAt),
      deliveryAt: fromLocalInputValue(draft.deliveryAt),
      status: draft.status,

      discountMode: draft.discountMode,
      discountType: draft.discountMode === 'SUBTOTAL' ? draft.discountType : null,
      discountValue:
        draft.discountMode === 'SUBTOTAL' && draft.discountType === 'VALUE' && draft.discountValue.trim()
          ? parseMoneyToNumber(draft.discountValue, moneyLocale)
          : null,
      discountPercent:
        draft.discountMode === 'SUBTOTAL' && draft.discountType === 'PERCENT' && draft.discountPercent.trim()
          ? Number(draft.discountPercent.replace(',', '.'))
          : null,

      items,
    }

    try {
      if (draft.id) {
        await updateM.mutateAsync({ id: draft.id, payload })
        toastUpdated(i, 'order')
      } else {
        await createM.mutateAsync(payload)
        toastCreated(i, 'order')
      }

      setIsOpen(false)
      draftStore.clear()
    } catch (e: any) {
      toastFailedToSave(i, String(e?.message ?? ''))
      throw e
    }
  }

  async function remove() {
    if (!draft.id) return
    if (!confirm(i.modal.deleteConfirm)) return
    try {
      await deleteM.mutateAsync(draft.id)
      toastDeleted(i, 'order')
      setIsOpen(false)
      draftStore.clear()
    } catch (e: any) {
      toastFailedToDelete(i, String(e?.message ?? ''))
      throw e
    }
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
              className="btn btn-primary"
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
          <div className="surface modal-safe absolute left-3 right-3 top-24 mx-auto w-full max-w-md rounded-2xl border border-theme p-4 shadow-xl">
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
                className="btn btn-secondary btn-icon"
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
                className="btn btn-primary"
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
            <div className="flex flex-col gap-2">
              <div className="rounded-xl border border-theme bg-[var(--surface)]/40 p-3">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={listQuery}
                      onChange={(e) => setListQuery(e.target.value)}
                      placeholder={
                        language === 'pt'
                          ? 'Buscar código, pedido ou cliente…'
                          : language === 'es'
                            ? 'Buscar código, pedido o cliente…'
                            : 'Search code, order or client…'
                      }
                      className="min-w-[220px] flex-1 rounded-lg border border-theme bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
                    />

                    <select
                      value={view}
                      onChange={(e) => setView(e.target.value as any)}
                      className="h-9 rounded-lg border border-theme bg-[var(--surface)] px-2 text-sm text-[var(--foreground)]"
                      title={language === 'pt' ? 'Visualização' : language === 'es' ? 'Vista' : 'View'}
                    >
                      <option value="upcoming">{language === 'pt' ? 'Operacional' : language === 'es' ? 'Operativo' : 'Operational'}</option>
                      <option value="history">{language === 'pt' ? 'Histórico' : language === 'es' ? 'Historial' : 'History'}</option>
                      <option value="all">{language === 'pt' ? 'Todos' : language === 'es' ? 'Todos' : 'All'}</option>
                    </select>

                    {/** Toggles */}
                    <button
                      type="button"
                      className={
                        'chip ' + (createdByMe ? 'chip-on' : '')
                      }
                      onClick={() => setCreatedByMe((v) => !v)}
                    >
                      {language === 'pt' ? 'Criado por mim' : language === 'es' ? 'Creado por mí' : 'Created by me'}
                    </button>

                    <button
                      type="button"
                      className={
                        'chip ' + (ownerMe ? 'chip-on' : '')
                      }
                      onClick={() => setOwnerMe((v) => !v)}
                    >
                      {language === 'pt' ? 'Responsável: eu' : language === 'es' ? 'Responsable: yo' : 'Owner: me'}
                    </button>

                    <button
                      type="button"
                      className={
                        'chip ' + (overdueOnly ? 'chip-danger-on' : '')
                      }
                      onClick={() => setOverdueOnly((v) => !v)}
                    >
                      {language === 'pt' ? 'Atrasados' : language === 'es' ? 'Atrasados' : 'Overdue'}
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        const p = new URLSearchParams(ordersParams)
                        p.set('currency', currency)
                        window.location.href = `/api/orders/export/csv?${p.toString()}`
                      }}
                    >
                      {language === 'pt' ? 'CSV' : language === 'es' ? 'CSV' : 'CSV'}
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        const p = new URLSearchParams(ordersParams)
                        p.set('currency', currency)
                        window.location.href = `/api/orders/export/pdf?${p.toString()}`
                      }}
                    >
                      {language === 'pt' ? 'PDF' : language === 'es' ? 'PDF' : 'PDF'}
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setListQuery('')
                        setCreatedByMe(false)
                        setOwnerMe(false)
                        setOverdueOnly(false)
                        setStatusFilter([])
                        setView('upcoming')
                      }}
                    >
                      {language === 'pt' ? 'Limpar' : language === 'es' ? 'Limpiar' : 'Clear'}
                    </button>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {STATUS_ORDER.filter((s) => s !== 'DONE' && s !== 'CANCELLED').map((st) => {
                    const on = statusFilter.includes(st)
                    return (
                      <button
                        key={st}
                        type="button"
                        className={
                          'chip ' + (on ? 'chip-on' : '')
                        }
                        onClick={() =>
                          setStatusFilter((prev) => {
                            const set = new Set(prev)
                            if (set.has(st)) set.delete(st)
                            else set.add(st)
                            return STATUS_ORDER.filter((x) => set.has(x))
                          })
                        }
                      >
                        {statusLabel(st)}
                      </button>
                    )
                  })}
                </div>
              </div>

            </div>

            <DataTable
              rows={sorted}
              empty={i.orders.empty}
              labels={i.table}
              showSearch={false}
              initialSort={{ key: 'deliveryAt', dir: 'asc' }}
              onRowClick={openDetails}
              columns={[
                {
                  key: 'name',
                  header: language === 'pt' ? 'Pedido' : language === 'es' ? 'Pedido' : 'Order',
                  sortValue: (r) => `${r.code ?? ''} ${r.name}`,
                  searchValue: (r) => `${r.code ?? ''} ${r.name}`,
                  render: (r) => (
                    <div className="font-medium text-[var(--foreground)]">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{r.name}</span>
                        {r.code ? <span className="badge badge-muted">{r.code}</span> : null}
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'status',
                  header: i.orders.status,
                  sortValue: (r) => r.status,
                  searchValue: (r) => r.status,
                  render: (r) => (
                    <span className={'rounded-full px-2 py-0.5 text-xs ' + statusBadgeClass(r.status)}>
                      {statusLabel(r.status)}
                    </span>
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
                    <div className="text-right tabular-nums text-[var(--muted-foreground)]">
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
                {
                  key: 'actions',
                  header: '',
                  sortValue: () => 0,
                  render: (r) => (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        className="btn btn-secondary btn-xs"
                        onClick={(e) => {
                          e.stopPropagation()
                          openEdit(r)
                        }}
                      >
                        {language === 'pt' ? 'Editar' : language === 'es' ? 'Editar' : 'Edit'}
                      </button>
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
                className="btn btn-secondary btn-sm"
                onClick={() => calRef.current?.getApi().today()}
              >
                {i.calendar.today}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn btn-secondary btn-icon"
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
                  className="btn btn-secondary btn-icon"
                  aria-label="Próximo mês"
                  onClick={() => calRef.current?.getApi().next()}
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>

              <button
                type="button"
                className="btn btn-secondary btn-icon"
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
                className="btn btn-secondary btn-sm"
                onClick={() => calModalRef.current?.getApi().today()}
              >
                {i.calendar.today}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn btn-secondary btn-icon"
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
                  className="btn btn-secondary btn-icon"
                  aria-label="Próximo mês"
                  onClick={() => calModalRef.current?.getApi().next()}
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>

              <button
                type="button"
                className="btn btn-secondary btn-icon"
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
          <div className="surface modal-safe absolute bottom-0 left-0 right-0 mx-auto w-full max-w-6xl rounded-t-2xl border border-theme p-5 shadow-xl sm:bottom-auto sm:top-10 sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{draft.id ? i.modal.editTitleOrder : i.modal.newTitleOrder}</h2>
                <p className="text-sm text-[var(--text-muted)]">{i.modal.subtitleOrder}</p>
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
                <FieldLabel required>{i.modal.orderNameLabel}</FieldLabel>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder={i.modal.orderNamePlaceholder}
                  className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                />
              </label>

              <label className="grid gap-1">
                <FieldLabel>{i.modal.clientLabel}</FieldLabel>

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
                    hint:
                      language === 'pt'
                        ? 'Digite pelo menos 2 letras…'
                        : language === 'es'
                          ? 'Escribe 2+ letras…'
                          : 'Type at least 2 letters…',
                    loading: language === 'pt' ? 'Buscando…' : language === 'es' ? 'Buscando…' : 'Searching…',
                    empty:
                      language === 'pt'
                        ? 'Nenhum cliente encontrado.'
                        : language === 'es'
                          ? 'No se encontraron clientes.'
                          : 'No clients found.',
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
                  <FieldLabel>{i.modal.orderedAtLabel}</FieldLabel>
                  <input
                    type="datetime-local"
                    value={draft.orderedAt}
                    onChange={(e) => setDraft((d) => ({ ...d, orderedAt: e.target.value }))}
                    className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                  />
                </label>
                <label className="grid gap-1">
                  <FieldLabel>{i.modal.deliveryAtLabel}</FieldLabel>
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

              <div className="mt-2 rounded-lg border border-theme p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-medium">{i.modal.itemsTitle}</div>

                  <div className="flex flex-wrap items-center gap-2">
                    {draft.id ? (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setScanOpen(true)}
                        disabled={scanM.isPending}
                      >
                        {language === 'pt' ? 'Escanear EAN' : language === 'es' ? 'Escanear EAN' : 'Scan'}
                      </button>
                    ) : null}

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={addItemLine}
                      disabled={productsQ.isLoading || (productsQ.data?.products?.length ?? 0) === 0}
                    >
                      {i.modal.addItem}
                    </button>
                  </div>
                </div>

                {draft.items.length === 0 ? (
                  <div className="mt-2 text-sm text-neutral-600">{i.modal.noItems}</div>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-[var(--muted-foreground)]">
                          <th className="py-2 pr-3">{language === 'pt' ? 'Produto' : language === 'es' ? 'Producto' : 'Product'}</th>
                          <th className="py-2 pr-3 text-right">{language === 'pt' ? 'Qtd.' : language === 'es' ? 'Cant.' : 'Qty'}</th>
                          <th className="py-2 pr-3">{language === 'pt' ? 'Unid.' : language === 'es' ? 'Unid.' : 'Unit'}</th>
                          <th className="py-2 pr-3 text-right">{language === 'pt' ? 'Preço un.' : language === 'es' ? 'Precio un.' : 'Unit price'}</th>
                          <th className="py-2 pr-3 text-right">{language === 'pt' ? 'Subtotal' : language === 'es' ? 'Subtotal' : 'Subtotal'}</th>

                          <th className="py-2 pr-3 text-right">{language === 'pt' ? 'Desconto' : language === 'es' ? 'Descuento' : 'Discount'}</th>

                          <th className="py-2 pr-3 text-right">{language === 'pt' ? 'Total' : language === 'es' ? 'Total' : 'Total'}</th>
                          <th className="py-2 text-right">{language === 'pt' ? 'Ações' : language === 'es' ? 'Acciones' : 'Actions'}</th>
                        </tr>
                      </thead>

                      <tbody>
                        {draft.items.map((it, idx) => {
                          const qty = Number(String(it.quantity ?? '').replace(',', '.'))
                          const unit = it.unitPrice?.trim() ? (parseMoneyToNumber(it.unitPrice, moneyLocale) ?? 0) : 0
                          const subtotal = (Number.isFinite(qty) ? Math.max(0, qty) : 0) * Math.max(0, unit)

                          let disc = 0
                          if (draft.discountMode === 'PER_ITEM') {
                            const dv = it.discountValue?.trim() ? Math.max(0, parseMoneyToNumber(it.discountValue, moneyLocale) ?? 0) : 0
                            if (dv > 0) {
                              disc = dv
                            } else {
                              const p = clampPercent(Number(String(it.discountPercent ?? '').replace(',', '.')))
                              disc = (subtotal * p) / 100
                            }

                            // keep total > 0 when subtotal > 0
                            if (subtotal > 0) disc = Math.min(Math.max(0, subtotal - 0.01), Math.max(0, disc))
                            else disc = 0
                          }

                          const total = Math.max(0, subtotal - disc)

                          return (
                            <tr key={idx} className="border-t border-theme align-top">
                              <td className="py-2 pr-3">
                                <SearchSelect
                                  value={
                                    it.productId
                                      ? (() => {
                                          const found = (productsQ.data?.products ?? []).find((p) => p.id === it.productId)
                                          const label = found ? `${found.name} (${found.unit})` : '—'
                                          return { id: it.productId, label }
                                        })()
                                      : null
                                  }
                                  onChange={(next) => updateItemLine(idx, { productId: next?.id ?? '' })}
                                  minChars={2}
                                  labels={{
                                    placeholder: language === 'pt' ? 'Selecione um produto…' : language === 'es' ? 'Selecciona un producto…' : 'Select a product…',
                                    hint:
                                      language === 'pt'
                                        ? 'Digite pelo menos 2 letras…'
                                        : language === 'es'
                                          ? 'Escribe 2+ letras…'
                                          : 'Type at least 2 letters…',
                                    loading: language === 'pt' ? 'Buscando…' : language === 'es' ? 'Buscando…' : 'Searching…',
                                    empty:
                                      language === 'pt'
                                        ? 'Nenhum produto encontrado.'
                                        : language === 'es'
                                          ? 'No se encontraron productos.'
                                          : 'No products found.',
                                  }}
                                  fetcher={async (q) => {
                                    const res = await fetch(`/api/products?kind=FINISHED&q=${encodeURIComponent(q)}`)
                                    if (!res.ok) throw new Error(await res.text())
                                    const data = (await res.json()) as { products: Array<{ id: string; name: string; unit: string }> }
                                    return (data.products ?? []).map((p) => ({ id: p.id, label: `${p.name} (${p.unit})` }))
                                  }}
                                />
                              </td>

                              <td className="py-2 pr-3">
                                <input
                                  value={it.quantity}
                                  onChange={(e) => updateItemLine(idx, { quantity: e.target.value })}
                                  className="w-24 rounded-lg border border-theme bg-transparent px-3 py-2 text-sm tabular-nums text-right"
                                  placeholder={i.modal.quantityPlaceholder}
                                />
                              </td>

                              <td className="py-2 pr-3">
                                <select
                                  value={it.unit ?? ''}
                                  onChange={(e) => updateItemLine(idx, { unit: e.target.value })}
                                  className="w-24 rounded-lg border border-theme bg-transparent px-3 py-2 text-sm"
                                  title="Unidade usada na quantidade e no preço unitário"
                                >
                                  {(() => {
                                    const p = (productsQ.data?.products ?? []).find((p) => p.id === it.productId)
                                    const base = p?.unit
                                    const opts =
                                      base === 'gr' || base === 'g'
                                        ? ['gr', 'kg']
                                        : base === 'kg'
                                          ? ['kg', 'gr']
                                          : base === 'ml'
                                            ? ['ml', 'l']
                                            : base === 'l'
                                              ? ['l', 'ml']
                                              : base === 'un'
                                                ? ['un', 'dz']
                                                : base === 'dz'
                                                  ? ['dz', 'un']
                                                  : base
                                                    ? [base]
                                                    : []
                                    return opts.map((u) => (
                                      <option key={u} value={u}>
                                        {u}
                                      </option>
                                    ))
                                  })()}
                                </select>
                              </td>

                              <td className="py-2 pr-3">
                                <input
                                  value={it.unitPrice}
                                  onChange={(e) => updateItemLine(idx, { unitPrice: formatMoneyFromInput(e.target.value, moneyLocale) })}
                                  className="w-32 rounded-lg border border-theme bg-transparent px-3 py-2 text-sm tabular-nums text-right"
                                  inputMode="numeric"
                                  placeholder={language === 'pt' ? 'Preço un.' : language === 'es' ? 'Precio un.' : 'Unit price'}
                                />
                              </td>

                              <td className="py-2 pr-3 text-right">
                                <div className="min-w-[96px] tabular-nums text-[var(--text-muted)]">
                                  {formatMoneyDisplay(subtotal, moneyLocale, currency)}
                                </div>
                              </td>

                              <td className="py-2 pr-3 text-right">
                                <div className="flex justify-end gap-2">
                                  <input
                                    value={it.discountPercent ?? ''}
                                    onChange={(e) => updateItemLine(idx, { discountPercent: e.target.value })}
                                    className="w-20 rounded-lg border border-theme bg-transparent px-3 py-2 text-sm tabular-nums text-right"
                                    inputMode="decimal"
                                    placeholder="%"
                                    disabled={draft.discountMode !== 'PER_ITEM'}
                                  />
                                  <input
                                    value={it.discountValue ?? ''}
                                    onChange={(e) => updateItemLine(idx, { discountValue: formatMoneyFromInput(e.target.value, moneyLocale) })}
                                    className="w-32 rounded-lg border border-theme bg-transparent px-3 py-2 text-sm tabular-nums text-right"
                                    inputMode="numeric"
                                    placeholder={language === 'pt' ? 'R$' : language === 'es' ? '$' : '$'}
                                    disabled={draft.discountMode !== 'PER_ITEM'}
                                  />
                                </div>
                              </td>

                              <td className="py-2 pr-3 text-right">
                                <div className="min-w-[96px] tabular-nums text-[var(--text-muted)]">
                                  {formatMoneyDisplay(total, moneyLocale, currency)}
                                </div>
                              </td>

                              <td className="py-2 text-right">
                                <button
                                  type="button"
                                  className="btn btn-danger-soft btn-sm whitespace-nowrap"
                                  onClick={() => removeItemLine(idx)}
                                  aria-label={i.modal.removeItem}
                                  title={i.modal.removeItem}
                                >
                                  {i.modal.removeItem}
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="mt-4 grid gap-3 border-t border-theme pt-3 sm:grid-cols-[1fr_280px] sm:items-start">
                  {/** Discount config (kept close to totals for clarity) */}
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-[var(--muted-foreground)]">{language === 'pt' ? 'Desconto' : language === 'es' ? 'Descuento' : 'Discount'}</div>

                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-4">
                      <select
                        value={draft.discountMode}
                        onChange={(e) => {
                          const nextMode = e.target.value as any
                          setDraft((d) => {
                            // If switching away from per-item discounts, clear per-item fields.
                            if (nextMode !== 'PER_ITEM' && d.discountMode === 'PER_ITEM') {
                              return {
                                ...d,
                                discountMode: nextMode,
                                items: d.items.map((it) => ({
                                  ...it,
                                  discountType: null,
                                  discountValue: '',
                                  discountPercent: '',
                                })),
                              }
                            }

                            return { ...d, discountMode: nextMode }
                          })
                        }}
                        className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                        disabled={hasAnyItemDiscount}
                        title={
                          hasAnyItemDiscount
                            ? language === 'pt'
                              ? 'Desconto por item ativo: limpe os descontos por item para usar desconto no total.'
                              : language === 'es'
                                ? 'Descuento por ítem activo: limpia los descuentos por ítem para usar descuento en el total.'
                                : 'Per-item discount active: clear item discounts to use total discount.'
                            : undefined
                        }
                      >
                        <option value="SUBTOTAL">No total</option>
                        <option value="PER_ITEM">Por item</option>
                      </select>

                      <select
                        value={draft.discountType}
                        onChange={(e) => {
                          const nextType = e.target.value as any
                          setDraft((d) => {
                            // keep only one filled; wipe the other to avoid ambiguity
                            if (nextType === 'VALUE') return { ...d, discountType: nextType, discountPercent: '' }
                            return { ...d, discountType: nextType, discountValue: '' }
                          })
                        }}
                        className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                        disabled={draft.discountMode !== 'SUBTOTAL' || hasAnyItemDiscount}
                      >
                        <option value="VALUE">Valor</option>
                        <option value="PERCENT">%</option>
                      </select>

                      {draft.discountMode === 'SUBTOTAL' ? (
                        <input
                          value={draft.discountValue}
                          onChange={(e) => setDraft((d) => ({ ...d, discountValue: formatMoneyFromInput(e.target.value, moneyLocale) }))}
                          inputMode="numeric"
                          placeholder={language === 'pt' ? 'R$' : language === 'es' ? '$' : '$'}
                          className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                          disabled={draft.discountType !== 'VALUE' || hasAnyItemDiscount}
                        />
                      ) : (
                        <div className="hidden sm:block" />
                      )}

                      {draft.discountMode === 'SUBTOTAL' ? (
                        <input
                          value={draft.discountPercent}
                          onChange={(e) => setDraft((d) => ({ ...d, discountPercent: e.target.value }))}
                          inputMode="decimal"
                          placeholder="%"
                          className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                          disabled={draft.discountType !== 'PERCENT' || hasAnyItemDiscount}
                        />
                      ) : (
                        <div className="text-xs text-[var(--text-muted)] sm:col-span-2">Configure os descontos na seção de itens.</div>
                      )}
                    </div>

                    {hasAnyItemDiscount ? (
                      <div className="mt-2 text-xs text-[var(--text-muted)]">
                        {language === 'pt'
                          ? 'Há desconto por item. O desconto no total fica desativado até você limpar os descontos dos itens.'
                          : language === 'es'
                            ? 'Hay descuento por ítem. El descuento en el total queda desactivado hasta que limpies los descuentos de los ítems.'
                            : 'Per-item discount is active. Total discount is disabled until you clear item discounts.'}
                      </div>
                    ) : null}
                  </div>

                  {/** Totals */}
                  <div className="flex flex-col gap-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--text-muted)]">{language === 'pt' ? 'Total bruto' : language === 'es' ? 'Total bruto' : 'Gross total'}</span>
                      <span className="tabular-nums">{formatMoneyDisplay(liveTotals.subtotal, moneyLocale, currency)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--text-muted)]">{language === 'pt' ? 'Desconto' : language === 'es' ? 'Descuento' : 'Discount'}</span>
                      <span className="tabular-nums">{formatMoneyDisplay(liveTotals.discount, moneyLocale, currency)}</span>
                    </div>
                    <div className="flex items-center justify-between font-semibold">
                      <span>{language === 'pt' ? 'Total após desconto' : language === 'es' ? 'Total tras descuento' : 'Total after discount'}</span>
                      <span className="tabular-nums">{formatMoneyDisplay(liveTotals.total, moneyLocale, currency)}</span>
                    </div>
                  </div>
                </div>
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
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                className="btn btn-danger-soft"
                onClick={remove}
                type="button"
                disabled={!draft.id || deleteM.isPending}
              >
                {i.modal.delete}
              </button>

              <div className="flex gap-2">
                <button
                  className="btn btn-secondary"
                  onClick={() => setIsOpen(false)}
                  type="button"
                >
                  {i.modal.cancel}
                </button>
                <button
                  className="btn btn-primary"
                  onClick={save}
                  type="button"
                  disabled={
                    !draft.name.trim() ||
                    !draft.clientId ||
                    !draft.items.some((it) => it.productId && Number(it.quantity.replace(',', '.')) > 0) ||
                    createM.isPending ||
                    updateM.isPending
                  }
                >
                  {i.modal.save}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {scanOpen ? (
        <BarcodeScanModal
          language={language}
          onClose={() => setScanOpen(false)}
          onScanned={async (p) => {
            if (!draft.id) return
            try {
              const res = await scanM.mutateAsync({ id: draft.id, payload: p })
              if (res?.result === 'ADDED' && res?.order?.items) {
                setDraft((d) => ({
                  ...d,
                  items: (res.order.items ?? []).map((it: any) => ({
                    productId: it.product.id,
                    quantity: String(it.quantity),
                    unitPrice: it.unitPrice == null ? '' : formatMoneyFromNumber(Number(it.unitPrice), moneyLocale),
                    unit: it.product.unit,
                    discountType: it.discountType ?? null,
                    discountValue: it.discountValue == null ? '' : formatMoneyFromNumber(Number(it.discountValue), moneyLocale),
                    discountPercent: it.discountPercent == null ? '' : String(it.discountPercent),
                  })),
                }))
                toast.success(language === 'pt' ? 'Adicionado ao pedido.' : language === 'es' ? 'Añadido al pedido.' : 'Added to order.')
                setScanOpen(false)
                return
              }

              if (res?.result === 'FOUND_EXTERNAL') {
                toast.error(
                  language === 'pt'
                    ? 'Código encontrado externamente, mas ainda não está vinculado a um produto.'
                    : language === 'es'
                      ? 'Código encontrado externamente, pero aún no está vinculado a un producto.'
                      : 'Found externally, but not linked to a product yet.',
                )
                return
              }

              toast.error(language === 'pt' ? 'Código não encontrado.' : language === 'es' ? 'Código no encontrado.' : 'Code not found.')
            } catch (e: any) {
              toastFailedToSave(i, String(e?.message ?? e ?? ''))
            }
          }}
        />
      ) : null}
    </div>
  )
}
