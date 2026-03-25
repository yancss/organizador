'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import DataTable, { type ColumnDef } from '../../ui/data-table'
import SearchSelect from '../../ui/search-select'
import FieldLabel from '../../ui/field-label'

import { useDraftStorage } from '../../use-draft-storage'
import { useSettings } from '../../settings-context'
import { t } from '../../i18n'
import { formatMoneyDisplay, formatMoneyFromInput, formatMoneyFromNumber, localeFromLanguage, parseMoneyToNumber } from '../../money'
import { api } from '../../api-client'
import { toast, toastCreated, toastUpdated, toastDeleted, toastFailedToSave, toastFailedToDelete } from '../../toast'

type Supplier = { id: string; name: string }

type Product = { id: string; name: string; unit: string }

type PurchaseOrderItemDraft = { productId: string; quantity: string; unitCost: string; unit?: string }

type PurchaseOrder = {
  id: string
  supplier: string | null
  status: 'DRAFT' | 'CONFIRMED' | 'RECEIVED' | 'CANCELLED'
  orderedAt: string | null
  observations: string | null
  estimatedCost: string | number | null
  supplierEntity: Supplier | null
  items: Array<{ id: string; quantity: string | number; unitCost?: string | number | null; product: Product }>
}

type Draft = {
  id?: string
  supplierId: string
  orderedAt: string
  status: PurchaseOrder['status']
  estimatedCost: string
  observations: string
  items: PurchaseOrderItemDraft[]
}

function emptyDraft(): Draft {
  return {
    supplierId: '',
    orderedAt: '',
    status: 'DRAFT',
    estimatedCost: '',
    observations: '',
    items: [],
  }
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

  // Camera scan (best-effort; falls back to manual input)
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
    const video = document.getElementById('ean-video') as HTMLVideoElement | null

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
              // auto-trigger with current qty
              onScanned({ code: v, qty })
              return
            }
          } catch {
            // ignore detection errors
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
    onScanned({ code: c, qty })
  }

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="surface modal-safe absolute bottom-0 left-0 right-0 mx-auto w-full max-w-lg rounded-t-2xl border border-theme p-5 shadow-xl sm:bottom-auto sm:top-24 sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{language === 'pt' ? 'Escanear EAN' : 'Scan barcode'}</h2>
            <p className="text-sm text-[var(--text-muted)]">{language === 'pt' ? 'Leia o código e adicione ao pedido.' : 'Read a code and add it to the order.'}</p>
          </div>
          <button className="btn btn-secondary btn-icon" onClick={onClose} type="button" aria-label={language === 'pt' ? 'Fechar' : 'Close'}>
            ×
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          <label className="grid gap-1">
            <span className="text-xs font-medium text-[var(--foreground)]">{language === 'pt' ? 'Código' : 'Code'}</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
              placeholder={language === 'pt' ? 'EAN…' : 'EAN…'}
              inputMode="numeric"
            />
          </label>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="grid gap-1">
              <span className="text-xs font-medium text-[var(--foreground)]">{language === 'pt' ? 'Quantidade' : 'Qty'}</span>
              <input
                value={String(qty)}
                onChange={(e) => setQty(Number(e.target.value.replace(',', '.')))}
                className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                inputMode="decimal"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => setQty((q) => q + 1)}>
                +1
              </button>
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => setQty((q) => q + 5)}>
                +5
              </button>
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => setQty((q) => q + 10)}>
                +10
              </button>
            </div>
          </div>

          {err ? <div className="text-sm text-red-600">{err}</div> : null}

          <div className="flex flex-col gap-2">
            <button className="btn btn-primary" type="button" onClick={submit}>
              {language === 'pt' ? 'Adicionar ao pedido' : 'Add to order'}
            </button>

            <button className="btn btn-secondary" type="button" onClick={() => setCameraOn((v) => !v)}>
              {cameraOn ? (language === 'pt' ? 'Parar câmera' : 'Stop camera') : language === 'pt' ? 'Usar câmera' : 'Use camera'}
            </button>

            {cameraOn ? (
              <div className="mt-2 overflow-hidden rounded-xl border border-theme bg-black">
                <video id="ean-video" className="h-56 w-full object-cover" muted playsInline />
              </div>
            ) : null}

            {cameraErr ? <div className="text-sm text-[var(--text-muted)]">{cameraErr}</div> : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function ReceiveConfirmModal({
  language,
  summary,
  onClose,
  onConfirm,
  isBusy,
}: {
  language: string
  summary: { distinctItems: number; totalUnits: number; estimatedCost: number | null }
  onClose: () => void
  onConfirm: () => void
  isBusy: boolean
}) {
  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="surface modal-safe absolute bottom-0 left-0 right-0 mx-auto w-full max-w-lg rounded-t-2xl border border-theme p-5 shadow-xl sm:bottom-auto sm:top-24 sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{language === 'pt' ? 'Receber pedido' : 'Receive order'}</h2>
            <p className="text-sm text-[var(--text-muted)]">{language === 'pt' ? 'Confirme para dar entrada no estoque.' : 'Confirm to add stock.'}</p>
          </div>
          <button className="btn btn-secondary btn-icon" onClick={onClose} type="button" aria-label={language === 'pt' ? 'Fechar' : 'Close'}>
            ×
          </button>
        </div>

        <div className="mt-4 grid gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-muted)]">{language === 'pt' ? 'Itens distintos' : 'Distinct items'}</span>
            <span className="font-medium">{summary.distinctItems}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-muted)]">{language === 'pt' ? 'Total de unidades' : 'Total units'}</span>
            <span className="font-medium">{summary.totalUnits}</span>
          </div>
          {summary.estimatedCost != null ? (
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-muted)]">{language === 'pt' ? 'Custo estimado' : 'Estimated cost'}</span>
              <span className="font-medium">{summary.estimatedCost}</span>
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex gap-2">
          <button className="btn btn-secondary" type="button" onClick={onClose} disabled={isBusy}>
            {language === 'pt' ? 'Cancelar' : 'Cancel'}
          </button>
          <button className="btn btn-primary" type="button" onClick={onConfirm} disabled={isBusy}>
            {language === 'pt' ? 'Confirmar e receber' : 'Confirm & receive'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PurchaseOrdersPage() {
  const qc = useQueryClient()
  const { language, currency } = useSettings()
  const i = t(language)
  const moneyLocale = localeFromLanguage(language)

  const [isOpen, setIsOpen] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)
  const [receiveSummary, setReceiveSummary] = useState<{ distinctItems: number; totalUnits: number; estimatedCost: number | null } | null>(null)

  const draftStore = useDraftStorage<Draft>('draft:purchaseOrders', emptyDraft)
  const draft = draftStore.value
  const setDraft = draftStore.setValue

  const productsQ = useQuery({
    queryKey: ['products', 'RAW'],
    queryFn: () => api<{ products: Product[] }>('/api/products?kind=RAW'),
  })

  const suppliersQ = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const data = await api<{ clients: Array<{ id: string; name: string; roles: string[] }> }>('/api/clients')
      const suppliers = (data.clients ?? []).filter((c) => (c.roles ?? []).includes('SUPPLIER'))
      return { suppliers: suppliers.map((s) => ({ id: s.id, name: s.name })) }
    },
  })

  const q = useQuery({
    queryKey: ['purchaseOrders'],
    queryFn: () => api<{ purchaseOrders: PurchaseOrder[] }>('/api/purchase-orders'),
  })

  const createM = useMutation({
    mutationFn: (payload: any) => api<{ purchaseOrder: PurchaseOrder }>('/api/purchase-orders', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['purchaseOrders'] })
    },
  })

  const updateM = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      api<{ purchaseOrder: PurchaseOrder }>(`/api/purchase-orders/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['purchaseOrders'] })
    },
  })

  const deleteM = useMutation({
    mutationFn: (id: string) => api<{ ok: true }>(`/api/purchase-orders/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['purchaseOrders'] })
    },
  })

  const scanM = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { code: string; qty: number } }) =>
      api<any>(`/api/purchase-orders/${id}/scan`, { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['purchaseOrders'] })
    },
  })

  const receiveM = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { dryRun?: boolean } }) =>
      api<any>(`/api/purchase-orders/${id}/receive`, { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['purchaseOrders'] })
    },
  })

  const rows = q.data?.purchaseOrders ?? []

  function statusLabel(s: PurchaseOrder['status']) {
    if (language === 'pt') {
      if (s === 'DRAFT') return 'Rascunho'
      if (s === 'CONFIRMED') return 'Confirmado'
      if (s === 'RECEIVED') return 'Recebido'
      return 'Cancelado'
    }
    if (language === 'es') {
      if (s === 'DRAFT') return 'Borrador'
      if (s === 'CONFIRMED') return 'Confirmado'
      if (s === 'RECEIVED') return 'Recibido'
      return 'Cancelado'
    }
    if (s === 'DRAFT') return 'Draft'
    if (s === 'CONFIRMED') return 'Confirmed'
    if (s === 'RECEIVED') return 'Received'
    return 'Cancelled'
  }

  function openCreate() {
    draftStore.clear()
    setIsOpen(true)
  }

  function openEdit(po: PurchaseOrder) {
    setDraft({
      id: po.id,
      supplierId: po.supplierEntity?.id ?? '',
      orderedAt: toLocalInputValue(po.orderedAt),
      status: po.status,
      estimatedCost: po.estimatedCost == null ? '' : formatMoneyFromNumber(Number(po.estimatedCost), moneyLocale),
      observations: po.observations ?? '',
      items: (po.items ?? []).map((it) => ({ productId: it.product.id, quantity: String(it.quantity), unitCost: it.unitCost == null ? '' : formatMoneyFromNumber(Number(it.unitCost), moneyLocale), unit: it.product.unit })), 
    })
    setIsOpen(true)
  }

  function addItemLine() {
    const products = productsQ.data?.products ?? []
    const used = new Set(draft.items.map((it) => it.productId))
    const firstAvailable = products.find((p) => !used.has(p.id))?.id ?? products[0]?.id ?? ''
    const p0 = products.find((p) => p.id === firstAvailable) ?? products[0]
    setDraft((d) => ({ ...d, items: [...d.items, { productId: firstAvailable, quantity: '1', unitCost: '', unit: p0?.unit }] }))
  }

  function updateItemLine(idx: number, patch: Partial<PurchaseOrderItemDraft>) {
    setDraft((d) => ({ ...d, items: d.items.map((it, i2) => (i2 === idx ? { ...it, ...patch } : it)) }))
  }

  function removeItemLine(idx: number) {
    setDraft((d) => ({ ...d, items: d.items.filter((_, i2) => i2 !== idx) }))
  }

  async function save() {
    if (!draft.supplierId.trim()) return

    const payload = {
      supplierId: draft.supplierId,
      supplier: null,
      orderedAt: fromLocalInputValue(draft.orderedAt),
      status: draft.status,
      estimatedCost: parseMoneyToNumber(draft.estimatedCost, moneyLocale),
      observations: draft.observations.trim() ? draft.observations : null,
      items: draft.items
        .filter((it) => it.productId && it.quantity.trim())
        .map((it) => ({
          productId: it.productId,
          quantity: Number(it.quantity.replace(',', '.')),
          unitCost: it.unitCost.trim() ? parseMoneyToNumber(it.unitCost, moneyLocale) : null,
          unit: it.unit ?? null,
        }))
        .filter((it) => Number.isFinite(it.quantity) && it.quantity > 0),
    }

    try {
      if (draft.id) {
        await updateM.mutateAsync({ id: draft.id, payload })
        toastUpdated(i, 'purchaseOrder')
      } else {
        await createM.mutateAsync(payload)
        toastCreated(i, 'purchaseOrder')
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
    if (!confirm(language === 'pt' ? 'Excluir este pedido de compra?' : language === 'es' ? '¿Eliminar este pedido de compra?' : 'Delete this purchase order?')) return
    try {
      await deleteM.mutateAsync(draft.id)
      toastDeleted(i, 'purchaseOrder')
      setIsOpen(false)
      draftStore.clear()
    } catch (e: any) {
      toastFailedToDelete(i, String(e?.message ?? ''))
      throw e
    }
  }

  async function scanAndAdd(payload: { code: string; qty: number }) {
    if (!draft.id) return
    try {
      const res = await scanM.mutateAsync({ id: draft.id, payload })

      if (res?.result === 'ADDED' && res?.purchaseOrder?.items) {
        // Update draft items from server state
        setDraft((d) => ({
          ...d,
          items: (res.purchaseOrder.items ?? []).map((it: any) => ({
            productId: it.product.id,
            quantity: String(it.quantity),
            unitCost: it.unitCost == null ? '' : formatMoneyFromNumber(Number(it.unitCost), moneyLocale),
            unit: it.product.unit,
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
      toastFailedToSave(i, String(e?.message ?? ''))
      throw e
    }
  }

  async function openReceiveConfirm() {
    if (!draft.id) return
    try {
      const res = await receiveM.mutateAsync({ id: draft.id, payload: { dryRun: true } })
      if (res?.summary) setReceiveSummary(res.summary)
    } catch (e: any) {
      toastFailedToSave(i, String(e?.message ?? ''))
      throw e
    }
  }

  async function confirmReceive() {
    if (!draft.id) return
    try {
      await receiveM.mutateAsync({ id: draft.id, payload: { dryRun: false } })
      toastUpdated(i, 'purchaseOrder')
      setReceiveSummary(null)

      // Keep modal open, but refresh local status.
      setDraft((d) => ({ ...d, status: 'RECEIVED' }))
    } catch (e: any) {
      toastFailedToSave(i, String(e?.message ?? ''))
      throw e
    }
  }

  const columns = useMemo<ColumnDef<PurchaseOrder>[]>(
    () => [
      {
        key: 'status',
        header: language === 'pt' ? 'Status' : language === 'es' ? 'Estado' : 'Status',
        sortValue: (r) => r.status,
        searchValue: (r) => statusLabel(r.status),
        render: (r) => (
          <span className="badge badge-solid">
            {statusLabel(r.status)}
          </span>
        ),
      },
      {
        key: 'supplier',
        header: language === 'pt' ? 'Fornecedor' : language === 'es' ? 'Proveedor' : 'Supplier',
        sortValue: (r) => r.supplierEntity?.name ?? r.supplier ?? '',
        searchValue: (r) => r.supplierEntity?.name ?? r.supplier ?? '',
        render: (r) => <div className="text-[var(--foreground)]">{r.supplierEntity?.name ?? r.supplier ?? '—'}</div>,
      },
      {
        key: 'orderedAt',
        header: language === 'pt' ? 'Data' : language === 'es' ? 'Fecha' : 'Date',
        sortValue: (r) => (r.orderedAt ? new Date(r.orderedAt) : new Date(0)),
        render: (r) => <div className="text-[var(--muted-foreground)]">{r.orderedAt ? new Date(r.orderedAt).toLocaleDateString() : '—'}</div>,
      },
      {
        key: 'estimatedCost',
        header: language === 'pt' ? 'Custo (est.)' : language === 'es' ? 'Costo (est.)' : 'Est. cost',
        sortValue: (r) => (r.estimatedCost == null ? -1 : Number(r.estimatedCost)),
        render: (r) => (
          <div className="text-[var(--muted-foreground)]">
            {r.estimatedCost == null ? '—' : formatMoneyDisplay(r.estimatedCost, moneyLocale, currency)}
          </div>
        ),
      },
      {
        key: 'items',
        header: language === 'pt' ? 'Itens' : language === 'es' ? 'Ítems' : 'Items',
        sortValue: (r) => r.items.length,
        render: (r) => <div className="text-[var(--muted-foreground)]">{r.items.length}</div>,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language, currency],
  )

  useEffect(() => {
    if (!isOpen) return
    // preload suppliers/products when opening modal
    void suppliersQ.refetch()
    void productsQ.refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            {language === 'pt' ? 'Pedidos de compra' : language === 'es' ? 'Pedidos de compra' : 'Purchase orders'}
          </h1>
          <p className="text-sm text-neutral-600">
            {language === 'pt'
              ? 'Crie e acompanhe pedidos de compra.'
              : language === 'es'
                ? 'Crea y gestiona pedidos de compra.'
                : 'Create and manage purchase orders.'}
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={openCreate}
          type="button"
        >
          {language === 'pt' ? 'Novo pedido' : language === 'es' ? 'Nuevo pedido' : 'New'}
        </button>
      </header>

      <DataTable
        rows={rows}
        columns={columns}
        empty={q.isLoading ? 'Carregando…' : q.error ? 'Erro ao carregar.' : 'Sem pedidos de compra.'}
        labels={i.table}
        initialSort={{ key: 'orderedAt', dir: 'desc' }}
        pageSize={25}
        onRowClick={openEdit}
      />

      {isOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsOpen(false)} />
          <div className="surface modal-safe absolute bottom-0 left-0 right-0 mx-auto w-full max-w-2xl rounded-t-2xl border border-theme p-5 shadow-xl sm:bottom-auto sm:top-20 sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{draft.id ? (language === 'pt' ? 'Editar pedido de compra' : language === 'es' ? 'Editar pedido de compra' : 'Edit purchase order') : language === 'pt' ? 'Novo pedido de compra' : language === 'es' ? 'Nuevo pedido de compra' : 'New purchase order'}</h2>
                <p className="text-sm text-[var(--text-muted)]">{language === 'pt' ? 'Fornecedor, data, itens, custo e observações.' : language === 'es' ? 'Proveedor, fecha, ítems, costo y observaciones.' : 'Supplier, date, items, cost, and notes.'}</p>
              </div>
              <button
                aria-label={language === 'pt' ? 'Fechar' : language === 'es' ? 'Cerrar' : 'Close'}
                className="btn btn-secondary btn-icon"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1">
                <FieldLabel required>{language === 'pt' ? 'Fornecedor' : language === 'es' ? 'Proveedor' : 'Supplier'}</FieldLabel>
                <SearchSelect
                  value={
                    draft.supplierId
                      ? (() => {
                          const found = (suppliersQ.data?.suppliers ?? []).find((s) => s.id === draft.supplierId)
                          return found ? { id: found.id, label: found.name } : null
                        })()
                      : null
                  }
                  onChange={(next) => setDraft((d) => ({ ...d, supplierId: next?.id ?? '' }))}
                  minChars={0}
                  labels={{
                    placeholder: language === 'pt' ? 'Selecione um fornecedor…' : language === 'es' ? 'Selecciona un proveedor…' : 'Select a supplier…',
                    hint: language === 'pt' ? 'Digite para buscar…' : language === 'es' ? 'Escribe para buscar…' : 'Type to search…',
                    loading: language === 'pt' ? 'Buscando…' : language === 'es' ? 'Buscando…' : 'Searching…',
                    empty: language === 'pt' ? 'Nenhum fornecedor encontrado.' : language === 'es' ? 'No se encontraron proveedores.' : 'No suppliers found.',
                  }}
                  fetcher={async (query) => {
                    if (!query.trim()) {
                      return (suppliersQ.data?.suppliers ?? []).map((s) => ({ id: s.id, label: s.name }))
                    }
                    const res = await fetch(`/api/clients?q=${encodeURIComponent(query)}`)
                    if (!res.ok) throw new Error(await res.text())
                    const data = (await res.json()) as { clients: Array<{ id: string; name: string; roles: string[] }> }
                    return (data.clients ?? [])
                      .filter((c) => (c.roles ?? []).includes('SUPPLIER'))
                      .map((c) => ({ id: c.id, label: c.name }))
                  }}
                />
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-[var(--foreground)]">{language === 'pt' ? 'Data do pedido' : language === 'es' ? 'Fecha' : 'Order date'}</span>
                  <input
                    type="datetime-local"
                    value={draft.orderedAt}
                    onChange={(e) => setDraft((d) => ({ ...d, orderedAt: e.target.value }))}
                    className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-medium text-[var(--foreground)]">{language === 'pt' ? 'Status' : language === 'es' ? 'Estado' : 'Status'}</span>
                  <select
                    value={draft.status}
                    onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as Draft['status'] }))}
                    className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                  >
                    <option value="DRAFT">{statusLabel('DRAFT')}</option>
                    <option value="CONFIRMED">{statusLabel('CONFIRMED')}</option>
                    <option value="RECEIVED">{statusLabel('RECEIVED')}</option>
                    <option value="CANCELLED">{statusLabel('CANCELLED')}</option>
                  </select>
                </label>
              </div>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-[var(--foreground)]">{language === 'pt' ? 'Custo estimado' : language === 'es' ? 'Costo estimado' : 'Estimated cost'}</span>
                <input
                  value={draft.estimatedCost}
                  onChange={(e) => setDraft((d) => ({ ...d, estimatedCost: formatMoneyFromInput(e.target.value, moneyLocale) }))}
                  inputMode="numeric"
                  placeholder={language === 'pt' ? 'Opcional' : language === 'es' ? 'Opcional' : 'Optional'}
                  className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-[var(--foreground)]">{language === 'pt' ? 'Observações' : language === 'es' ? 'Observaciones' : 'Notes'}</span>
                <textarea
                  value={draft.observations}
                  onChange={(e) => setDraft((d) => ({ ...d, observations: e.target.value }))}
                  placeholder={language === 'pt' ? 'Opcional' : language === 'es' ? 'Opcional' : 'Optional'}
                  className="min-h-24 w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                />
              </label>

              <div className="mt-2 rounded-lg border border-theme p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium">{language === 'pt' ? 'Itens' : language === 'es' ? 'Ítems' : 'Items'}</div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={addItemLine}
                    disabled={productsQ.isLoading || (productsQ.data?.products?.length ?? 0) === 0}
                  >
                    {language === 'pt' ? 'Adicionar item' : language === 'es' ? 'Añadir ítem' : 'Add item'}
                  </button>
                </div>

                {draft.items.length === 0 ? (
                  <div className="mt-2 text-sm text-neutral-600">
                    {language === 'pt' ? 'Sem itens ainda.' : language === 'es' ? 'Sin ítems.' : 'No items yet.'}
                  </div>
                ) : (
                  <div className="mt-3 grid gap-2">
                    {draft.items.map((it, idx) => (
                      <div key={idx} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px_140px_80px] sm:items-center">
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

                        <div className="grid grid-cols-[1fr_86px] gap-2">
                          <input
                            value={it.quantity}
                            onChange={(e) => updateItemLine(idx, { quantity: e.target.value })}
                            className="w-full rounded-lg border border-theme bg-transparent px-3 py-2 text-sm"
                            placeholder={language === 'pt' ? 'Qtd' : language === 'es' ? 'Cant.' : 'Qty'}
                          />
                          <select
                            value={it.unit ?? ''}
                            onChange={(e) => updateItemLine(idx, { unit: e.target.value })}
                            className="w-full rounded-lg border border-theme bg-transparent px-3 py-2 text-sm"
                            title="Unidade usada na quantidade e no custo unitário"
                          >
                            {(() => {
                              const p = (productsQ.data?.products ?? []).find((p) => p.id === it.productId)
                              const base = p?.unit
                              const opts = base === 'gr' || base === 'g' ? ['gr', 'kg'] : base === 'kg' ? ['kg', 'gr'] : base === 'ml' ? ['ml', 'l'] : base === 'l' ? ['l', 'ml'] : base === 'un' ? ['un', 'dz'] : base === 'dz' ? ['dz', 'un'] : base ? [base] : []
                              return opts.map((u) => (
                                <option key={u} value={u}>
                                  {u}
                                </option>
                              ))
                            })()}
                          </select>
                        </div>

                        <input
                          value={it.unitCost}
                          onChange={(e) => updateItemLine(idx, { unitCost: formatMoneyFromInput(e.target.value, moneyLocale) })}
                          className="w-full rounded-lg border border-theme bg-transparent px-3 py-2 text-sm"
                          inputMode="numeric"
                          placeholder={language === 'pt' ? 'Custo un.' : language === 'es' ? 'Costo un.' : 'Unit cost'}
                        />

                        <button
                          type="button"
                          className="btn btn-danger-soft"
                          onClick={() => removeItemLine(idx)}
                        >
                          {language === 'pt' ? 'Remover' : language === 'es' ? 'Quitar' : 'Remove'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                className="btn btn-danger-soft"
                onClick={remove}
                type="button"
                disabled={!draft.id || deleteM.isPending}
              >
                {language === 'pt' ? 'Excluir' : language === 'es' ? 'Eliminar' : 'Delete'}
              </button>

              <div className="flex flex-wrap gap-2 sm:justify-end">
                {draft.id && draft.status !== 'RECEIVED' && draft.status !== 'CANCELLED' ? (
                  <>
                    <button
                      className="btn btn-secondary"
                      type="button"
                      onClick={() => setScanOpen(true)}
                      disabled={scanM.isPending}
                    >
                      {language === 'pt' ? 'Escanear EAN' : language === 'es' ? 'Escanear EAN' : 'Scan'}
                    </button>
                    <button
                      className="btn btn-secondary"
                      type="button"
                      onClick={() => void openReceiveConfirm()}
                      disabled={receiveM.isPending}
                      title={language === 'pt' ? 'Finalizar e dar entrada no estoque' : 'Finalize and add stock'}
                    >
                      {language === 'pt' ? 'Receber' : language === 'es' ? 'Recibir' : 'Receive'}
                    </button>
                  </>
                ) : null}

                <button
                  className="btn btn-secondary"
                  onClick={() => setIsOpen(false)}
                  type="button"
                >
                  {language === 'pt' ? 'Cancelar' : language === 'es' ? 'Cancelar' : 'Cancel'}
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => void save()}
                  type="button"
                  disabled={!draft.supplierId.trim() || createM.isPending || updateM.isPending}
                >
                  {language === 'pt' ? 'Salvar' : language === 'es' ? 'Guardar' : 'Save'}
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
          onScanned={(p) => void scanAndAdd(p)}
        />
      ) : null}

      {receiveSummary ? (
        <ReceiveConfirmModal
          language={language}
          summary={receiveSummary}
          onClose={() => setReceiveSummary(null)}
          onConfirm={() => void confirmReceive()}
          isBusy={receiveM.isPending}
        />
      ) : null}
    </div>
  )
}
