'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import { useQuery } from '@tanstack/react-query'

import { api } from '../../api-client'
import { t } from '../../i18n'
import { useSettings } from '../../settings-context'

type ProductOption = {
  id: string
  name: string
  unit: string
}

type InventoryTraceEventRow = {
  id: string
  productId: string
  warehouseId?: string | null
  lotId?: string | null
  eventType: string
  quantity: string | number
  serialCodes?: string[]
  referenceType?: string | null
  referenceId?: string | null
  notes?: string | null
  createdAt: string
  productName?: string | null
  productUnit?: string | null
  warehouseName?: string | null
  lotCode?: string | null
  lotExpiresAt?: string | null
}

const REFERENCE_TYPES = ['PurchaseOrder', 'Delivery', 'Transfer', 'Production', 'Inventory']

// G9: deep-link — hidrata os filtros a partir da query string (?productId=&lotCode=&referenceType=&referenceId=).
function initialFilters() {
  const empty = { productId: '', lotCode: '', referenceType: '', referenceId: '' }
  if (typeof window === 'undefined') return empty
  const p = new URLSearchParams(window.location.search)
  return {
    productId: p.get('productId') ?? '',
    lotCode: p.get('lotCode') ?? '',
    referenceType: p.get('referenceType') ?? '',
    referenceId: p.get('referenceId') ?? '',
  }
}

export default function InventoryTracePage() {
  const { language } = useSettings()
  const i = t(language)
  const init = useMemo(initialFilters, [])
  const [productId, setProductId] = useState(init.productId)
  const [lotCode, setLotCode] = useState(init.lotCode)
  const [referenceType, setReferenceType] = useState(init.referenceType)
  const [referenceId, setReferenceId] = useState(init.referenceId)

  const ui = useMemo(
    () => ({
      title: language === 'pt' ? 'Rastreabilidade de estoque' : language === 'es' ? 'Trazabilidad de inventario' : 'Inventory traceability',
      subtitle:
        language === 'pt'
          ? 'Consulte a trilha de lote e documento para entender origem, destino e recomposicoes.'
          : language === 'es'
            ? 'Consulta la traza de lote y documento para entender origen, destino y recomposiciones.'
            : 'Inspect lot and document history to understand origin, destination, and restorations.',
      product: language === 'pt' ? 'Produto' : language === 'es' ? 'Producto' : 'Product',
      allProducts: language === 'pt' ? 'Todos os produtos' : language === 'es' ? 'Todos los productos' : 'All products',
      lotCode: language === 'pt' ? 'Codigo do lote' : language === 'es' ? 'Codigo del lote' : 'Lot code',
      lotPlaceholder:
        language === 'pt'
          ? 'Ex.: LOTE-2026-001'
          : language === 'es'
            ? 'Ej.: LOTE-2026-001'
            : 'Ex.: LOT-2026-001',
      referenceType: language === 'pt' ? 'Tipo de documento' : language === 'es' ? 'Tipo de documento' : 'Document type',
      allTypes: language === 'pt' ? 'Todos os tipos' : language === 'es' ? 'Todos los tipos' : 'All types',
      referenceId: language === 'pt' ? 'ID do documento' : language === 'es' ? 'ID del documento' : 'Document ID',
      referencePlaceholder:
        language === 'pt'
          ? 'Cole o ID completo ou prefixo'
          : language === 'es'
            ? 'Pega el ID completo o prefijo'
            : 'Paste full ID or prefix',
      clear: language === 'pt' ? 'Limpar filtros' : language === 'es' ? 'Limpiar filtros' : 'Clear filters',
      noEvents:
        language === 'pt'
          ? 'Nenhum evento encontrado para os filtros atuais.'
          : language === 'es'
            ? 'No se encontraron eventos para los filtros actuales.'
            : 'No events found for the current filters.',
      serials: language === 'pt' ? 'seriais' : language === 'es' ? 'seriales' : 'serials',
      openInventory: language === 'pt' ? 'Abrir estoque' : language === 'es' ? 'Abrir inventario' : 'Open inventory',
      reference: language === 'pt' ? 'Documento' : language === 'es' ? 'Documento' : 'Document',
      warehouse: language === 'pt' ? 'Local' : language === 'es' ? 'Ubicacion' : 'Location',
      expiry: language === 'pt' ? 'Validade' : language === 'es' ? 'Caducidad' : 'Expiry',
      loading: i.common.loading,
    }),
    [i.common.loading, language],
  )

  const productsQ = useQuery({
    queryKey: ['inventory-trace-products'],
    queryFn: () => api<{ products: ProductOption[] }>('/api/products?page=1&take=100'),
  })

  const traceUrl = useMemo(() => {
    const params = new URLSearchParams()
    params.set('take', '100')
    if (productId) params.set('productId', productId)
    if (lotCode.trim()) params.set('lotCode', lotCode.trim())
    if (referenceType) params.set('referenceType', referenceType)
    if (referenceId.trim()) params.set('referenceId', referenceId.trim())
    return `/api/inventory/trace?${params.toString()}`
  }, [lotCode, productId, referenceId, referenceType])

  const traceQ = useQuery({
    queryKey: ['inventory-trace-page', productId, lotCode, referenceType, referenceId],
    queryFn: () => api<{ events: InventoryTraceEventRow[]; movements: Array<{ id: string }> }>(traceUrl),
  })

  function clearFilters() {
    setProductId('')
    setLotCode('')
    setReferenceType('')
    setReferenceId('')
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{ui.title}</h1>
        </div>
        <Link href="/app/inventory" className="btn btn-secondary">
          {ui.openInventory}
        </Link>
      </div>

      <div className="grid gap-3 rounded-2xl border border-theme bg-[var(--surface)] p-4 md:grid-cols-4">
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-[var(--foreground)]">{ui.product}</span>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
          >
            <option value="">{ui.allProducts}</option>
            {(productsQ.data?.products ?? []).map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-[var(--foreground)]">{ui.lotCode}</span>
          <input
            value={lotCode}
            onChange={(e) => setLotCode(e.target.value)}
            placeholder={ui.lotPlaceholder}
            className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-[var(--foreground)]">{ui.referenceType}</span>
          <select
            value={referenceType}
            onChange={(e) => setReferenceType(e.target.value)}
            className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
          >
            <option value="">{ui.allTypes}</option>
            {REFERENCE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-[var(--foreground)]">{ui.referenceId}</span>
          <input
            value={referenceId}
            onChange={(e) => setReferenceId(e.target.value)}
            placeholder={ui.referencePlaceholder}
            className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
          />
        </label>
      </div>

      <div className="flex justify-end">
        <button type="button" className="btn btn-secondary" onClick={clearFilters}>
          {ui.clear}
        </button>
      </div>

      {traceQ.isLoading ? (
        <div className="rounded-2xl border border-theme bg-[var(--surface)] p-4 text-sm text-[var(--text-muted)]">{ui.loading}</div>
      ) : (traceQ.data?.events?.length ?? 0) === 0 ? (
        <div className="rounded-2xl border border-theme bg-[var(--surface)] p-4 text-sm text-[var(--text-muted)]">{ui.noEvents}</div>
      ) : (
        <div className="grid gap-3">
          {(traceQ.data?.events ?? []).map((event) => {
            const qty = Number(event.quantity ?? 0)
            return (
              <article key={event.id} className="rounded-2xl border border-theme bg-[var(--surface)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold text-[var(--foreground)]">
                      {event.productName ?? event.productId}
                    </div>
                    <div className="mt-1 text-sm text-[var(--text-muted)]">
                      {event.eventType}
                      {event.lotCode ? ` • ${event.lotCode}` : ''}
                    </div>
                  </div>
                  <div className={qty >= 0 ? 'text-sm font-medium text-emerald-700' : 'text-sm font-medium text-rose-700'}>
                    {qty >= 0 ? '+' : ''}
                    {qty} {event.productUnit ?? ''}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--text-muted)]">
                  <span>{new Date(event.createdAt).toLocaleString()}</span>
                  {event.referenceType && event.referenceId ? (
                    <span>
                      {ui.reference}: {event.referenceType} {event.referenceId.slice(0, 8)}
                    </span>
                  ) : null}
                  {event.warehouseName ? <span>{ui.warehouse}: {event.warehouseName}</span> : null}
                  {event.lotExpiresAt ? <span>{ui.expiry}: {new Date(event.lotExpiresAt).toLocaleDateString()}</span> : null}
                  {(event.serialCodes?.length ?? 0) > 0 ? <span>{event.serialCodes?.length} {ui.serials}</span> : null}
                </div>

                {event.notes ? <div className="mt-3 text-sm text-[var(--foreground)]">{event.notes}</div> : null}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
