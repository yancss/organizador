'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { api } from '@/app/app/api-client'
import { toastCreated, toastFailedToSave } from '@/app/app/toast'
import { useSettings } from '@/app/app/settings-context'
import { t } from '@/app/app/i18n'
import { formatMoneyDisplay, localeFromLanguage } from '@/app/app/money'
import { AuditHistory } from '@/app/app/audit-history'
import SearchSelect from '@/app/app/ui/search-select'
import { Pencil, Save, X } from 'lucide-react'

type Order = {
  id: string
  code: string | null
  name: string
  observations: string | null
  orderedAt: string | null
  deliveryAt: string | null
  status: string
  value: string | number | null

  discountMode?: 'SUBTOTAL' | 'PER_ITEM'
  discountType?: 'VALUE' | 'PERCENT' | null
  discountValue?: string | number | null
  discountPercent?: string | number | null

  client: { id: string; name: string } | null
  items: Array<{
    id: string
    quantity: string | number
    unitPrice: string | number
    discountType?: 'VALUE' | 'PERCENT' | null
    discountValue?: string | number | null
    discountPercent?: string | number | null
    product: { id: string; name: string; unit: string }
  }>
  reservationSummary?: {
    reservedQtyTotal: number
    orderedQtyTotal: number
    items: Array<{
      productId: string
      orderedQty: number
      reservedQty: number
      unreservedQty: number
    }>
  }
  createdById: string | null
  updatedById: string | null
  createdAt: string
  updatedAt: string
}

type Delivery = {
  id: string
  status: string
  plannedAt: string | null
  shippedAt: string | null
  deliveredAt: string | null
  value: string | number | null
  receivable?: { id: string; status: string; value: string | number } | null
}

type Receivable = {
  id: string
  status: string
  issuedAt: string | null
  dueAt: string
  value: string | number
  deliveryId: string | null
}

// (audit user formatting moved to AuditHistory component)

export default function SalesOrderDetailsPage() {
  const qc = useQueryClient()

  const params = useParams<{ id: string }>()
  const id = params?.id

  const { language, currency } = useSettings()
  const i = t(language)
  const moneyLocale = localeFromLanguage(language)

  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')

  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [itemDraft, setItemDraft] = useState<{
    productId: string
    quantity: string
    unitPrice: string
    discountPercent: string
    discountValue: string
  } | null>(null)

  const [editingClient, setEditingClient] = useState(false)
  const [clientDraft, setClientDraft] = useState<{ id: string; name: string } | null>(null)

  const [editingDeliveryAt, setEditingDeliveryAt] = useState(false)
  const [deliveryAtDraft, setDeliveryAtDraft] = useState('')

  const [editingStatus, setEditingStatus] = useState(false)
  const [statusDraft, setStatusDraft] = useState('')

  const [editingDiscountMode, setEditingDiscountMode] = useState(false)
  const [discountModeDraft, setDiscountModeDraft] = useState<'SUBTOTAL' | 'PER_ITEM'>('SUBTOTAL')

  const orderQ = useQuery({
    queryKey: ['order', id],
    enabled: !!id,
    queryFn: () => api<{ order: Order }>(`/api/orders/${id}`),
  })

  const patchOrderM = useMutation({
    mutationFn: (payload: any) => {
      if (!id) throw new Error('MISSING_ID')
      return api<{ order: Order }>(`/api/orders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
    },
    onSuccess: async () => {
      if (id) await qc.invalidateQueries({ queryKey: ['order', id] })
      await qc.invalidateQueries({ queryKey: ['orders'] })
    },
    onError: (e: any) => toastFailedToSave(i, String(e?.message ?? e ?? '')),
  })

  const deliveriesQ = useQuery({
    queryKey: ['deliveries', 'salesOrder', id],
    enabled: !!id,
    queryFn: () => api<{ deliveries: Delivery[] }>(`/api/deliveries?salesOrderId=${id}`),
  })

  const createDeliveryM = useMutation({
    mutationFn: async () => {
      if (!order) throw new Error('ORDER_NOT_LOADED')
      if (!order.client?.id) throw new Error('MISSING_CLIENT')
      if (!order.items?.length) throw new Error('MISSING_ITEMS')

      const payload = {
        salesOrderId: order.id,
        clientId: order.client.id,
        method: 'PICKUP',
        plannedAt: order.deliveryAt,
        value: order.value == null ? null : Number(order.value),
        items: order.items.map((it) => ({
          productId: it.product.id,
          quantity: Number(it.quantity),
        })),
      }

      return api<{ delivery: { id: string } }>('/api/deliveries', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    },
    onSuccess: async () => {
      toastCreated(i, 'delivery')
      await qc.invalidateQueries({ queryKey: ['deliveries'] })
      if (id) await qc.invalidateQueries({ queryKey: ['deliveries', 'salesOrder', id] })
    },
    onError: (e: any) => {
      toastFailedToSave(i, String(e?.message ?? e ?? ''))
    },
  })

  const receivablesQ = useQuery({
    queryKey: ['receivables', 'salesOrder', id],
    enabled: !!id,
    queryFn: () => api<{ receivables: Receivable[] }>(`/api/receivables?salesOrderId=${id}`),
  })


  const order = orderQ.data?.order

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

  // Initialize drafts when the order loads/changes
  useEffect(() => {
    if (!order) return
    if (!editingName) setNameDraft(order.name ?? '')
    if (!editingClient) setClientDraft(order.client ?? null)
    if (!editingDeliveryAt) setDeliveryAtDraft(toLocalInputValue(order.deliveryAt ?? null))
    if (!editingStatus) setStatusDraft(order.status ?? '')
    if (!editingDiscountMode) setDiscountModeDraft(((order.discountMode ?? 'SUBTOTAL') as any) === 'PER_ITEM' ? 'PER_ITEM' : 'SUBTOTAL')
  }, [order, editingName, editingClient, editingDeliveryAt, editingStatus, editingDiscountMode])

  // NOTE: this used to be memoized by `order?.items`, but React Compiler flags it because
  // the dependency array may include values that can be mutated later.
  // This map is tiny and cheap; compute it per-render for correctness and clean lint.
  const productLabelById = (() => {
    const m = new Map<string, string>()
    for (const it of order?.items ?? []) m.set(it.product.id, `${it.product.name} (${it.product.unit})`)
    return m
  })()

  const reservationByProductId = (() => {
    const map = new Map<string, { orderedQty: number; reservedQty: number; unreservedQty: number }>()
    for (const item of order?.reservationSummary?.items ?? []) map.set(item.productId, item)
    return map
  })()

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-theme bg-[var(--surface-2)] px-5 py-5 shadow-[var(--shadow-sm)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="text-sm text-[var(--muted-foreground)]">
            <Link href="/app/sales/orders" className="underline">
              {language === 'pt' ? 'Voltar' : language === 'es' ? 'Volver' : 'Back'}
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  className="w-full min-w-[220px] rounded-lg border border-theme bg-transparent px-3 py-2 text-sm"
                  autoFocus
                />

                <button
                  type="button"
                  className="btn btn-primary btn-icon"
                  title={language === 'pt' ? 'Salvar' : language === 'es' ? 'Guardar' : 'Save'}
                  onClick={async () => {
                    if (!order) return
                    const next = nameDraft.trim()
                    if (!next) return
                    await patchOrderM.mutateAsync({ name: next })
                    setEditingName(false)
                  }}
                  disabled={patchOrderM.isPending}
                >
                  <Save className="size-4" />
                </button>

                <button
                  type="button"
                  className="btn btn-secondary btn-icon"
                  title={language === 'pt' ? 'Cancelar' : language === 'es' ? 'Cancelar' : 'Cancel'}
                  onClick={() => {
                    setEditingName(false)
                    setNameDraft(order?.name ?? '')
                  }}
                  disabled={patchOrderM.isPending}
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight">
                  {order?.name ?? (language === 'pt' ? 'Pedido' : language === 'es' ? 'Pedido' : 'Order')}
                </h1>
                <button
                  type="button"
                  className="btn btn-secondary btn-icon"
                  title={language === 'pt' ? 'Editar' : language === 'es' ? 'Editar' : 'Edit'}
                  onClick={() => setEditingName(true)}
                  disabled={!order}
                >
                  <Pencil className="size-4" />
                </button>
              </div>
            )}

            {order?.code ? <span className="badge badge-muted">{order.code}</span> : null}
            {order?.status ? <span className="badge badge-solid">{order.status}</span> : null}
          </div>

          <div className="mt-2 rounded-xl border border-theme bg-[var(--surface)]/40 p-3">
            <div className="grid gap-3 sm:grid-cols-4">
              {/** Client */}
              <div className="space-y-1">
                <div className="text-xs font-medium text-[var(--muted-foreground)]">{i.orders.client}</div>

                {editingClient ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="min-w-[260px] flex-1">
                      <SearchSelect
                        value={clientDraft ? { id: clientDraft.id, label: clientDraft.name } : null}
                        onChange={(next) => setClientDraft(next ? { id: next.id, name: next.label } : null)}
                        minChars={2}
                        labels={{
                          placeholder: language === 'pt' ? 'Cliente…' : language === 'es' ? 'Cliente…' : 'Client…',
                          hint:
                            language === 'pt'
                              ? 'Digite pelo menos 2 letras…'
                              : language === 'es'
                                ? 'Escribe 2+ letras…'
                                : 'Type 2+ letters…',
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
                    </div>

                    <button
                      type="button"
                      className="btn btn-primary btn-icon"
                      title={language === 'pt' ? 'Salvar' : language === 'es' ? 'Guardar' : 'Save'}
                      onClick={async () => {
                        try {
                          await patchOrderM.mutateAsync({ clientId: clientDraft?.id ?? null })
                          setEditingClient(false)
                        } catch (e: any) {
                          toastFailedToSave(i, String(e?.message ?? e ?? ''))
                        }
                      }}
                      disabled={patchOrderM.isPending}
                    >
                      <Save className="size-4" />
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary btn-icon"
                      title={language === 'pt' ? 'Cancelar' : language === 'es' ? 'Cancelar' : 'Cancel'}
                      onClick={() => {
                        setEditingClient(false)
                        setClientDraft(order?.client ?? null)
                      }}
                      disabled={patchOrderM.isPending}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm text-[var(--foreground)]">
                      {order?.client?.name ?? i.orders.noClient}
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-icon"
                      title={language === 'pt' ? 'Editar cliente' : language === 'es' ? 'Editar cliente' : 'Edit client'}
                      onClick={() => setEditingClient(true)}
                      disabled={!order}
                    >
                      <Pencil className="size-4" />
                    </button>
                  </div>
                )}
              </div>

              {/** Status */}
              <div className="space-y-1">
                <div className="text-xs font-medium text-[var(--muted-foreground)]">
                  {language === 'pt' ? 'Status' : language === 'es' ? 'Estado' : 'Status'}
                </div>

                {editingStatus ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={statusDraft}
                      onChange={(e) => setStatusDraft(e.target.value)}
                      className="rounded-lg border border-theme bg-transparent px-3 py-2 text-sm"
                    >
                      {['DRAFT', 'CONFIRMED', 'IN_PRODUCTION', 'READY', 'SHIPPED', 'DONE', 'CANCELLED'].map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      className="btn btn-primary btn-icon"
                      title={language === 'pt' ? 'Salvar' : language === 'es' ? 'Guardar' : 'Save'}
                      onClick={async () => {
                        try {
                          await patchOrderM.mutateAsync({ status: statusDraft })
                          setEditingStatus(false)
                        } catch (e: any) {
                          toastFailedToSave(i, String(e?.message ?? e ?? ''))
                        }
                      }}
                      disabled={patchOrderM.isPending}
                    >
                      <Save className="size-4" />
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary btn-icon"
                      title={language === 'pt' ? 'Cancelar' : language === 'es' ? 'Cancelar' : 'Cancel'}
                      onClick={() => {
                        setEditingStatus(false)
                        setStatusDraft(order?.status ?? '')
                      }}
                      disabled={patchOrderM.isPending}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span className="badge badge-solid">{order?.status ?? '—'}</span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-icon"
                      title={language === 'pt' ? 'Editar status' : language === 'es' ? 'Editar estado' : 'Edit status'}
                      onClick={() => setEditingStatus(true)}
                      disabled={!order}
                    >
                      <Pencil className="size-4" />
                    </button>
                  </div>
                )}
              </div>

              {/** Ordered at (read-only) */}
              <div className="space-y-1">
                <div className="text-xs font-medium text-[var(--muted-foreground)]">
                  {language === 'pt' ? 'Pedido em' : language === 'es' ? 'Pedido en' : 'Ordered at'}
                </div>
                <div className="text-sm text-[var(--foreground)]">
                  {order?.orderedAt ? new Date(order.orderedAt).toLocaleString() : '—'}
                </div>
              </div>

              {/** Delivery at */}
              <div className="space-y-1">
                <div className="text-xs font-medium text-[var(--muted-foreground)]">
                  {language === 'pt' ? 'Entrega prevista' : language === 'es' ? 'Entrega prevista' : 'Delivery at'}
                </div>

                {editingDeliveryAt ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="datetime-local"
                      value={deliveryAtDraft}
                      onChange={(e) => setDeliveryAtDraft(e.target.value)}
                      className="rounded-lg border border-theme bg-transparent px-3 py-2 text-sm"
                      autoFocus
                    />

                    <button
                      type="button"
                      className="btn btn-primary btn-icon"
                      title={language === 'pt' ? 'Salvar' : language === 'es' ? 'Guardar' : 'Save'}
                      onClick={async () => {
                        try {
                          await patchOrderM.mutateAsync({ deliveryAt: fromLocalInputValue(deliveryAtDraft) })
                          setEditingDeliveryAt(false)
                        } catch (e: any) {
                          toastFailedToSave(i, String(e?.message ?? e ?? ''))
                        }
                      }}
                      disabled={patchOrderM.isPending}
                    >
                      <Save className="size-4" />
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary btn-icon"
                      title={language === 'pt' ? 'Cancelar' : language === 'es' ? 'Cancelar' : 'Cancel'}
                      onClick={() => {
                        setEditingDeliveryAt(false)
                        setDeliveryAtDraft(toLocalInputValue(order?.deliveryAt ?? null))
                      }}
                      disabled={patchOrderM.isPending}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm text-[var(--foreground)]">
                      {order?.deliveryAt ? new Date(order.deliveryAt).toLocaleString() : '—'}
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-icon"
                      title={language === 'pt' ? 'Editar entrega prevista' : language === 'es' ? 'Editar entrega prevista' : 'Edit delivery date'}
                      onClick={() => setEditingDeliveryAt(true)}
                      disabled={!order}
                    >
                      <Pencil className="size-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:justify-end">
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => createDeliveryM.mutate()}
            disabled={!order || createDeliveryM.isPending}
            title={language === 'pt' ? 'Cria uma entrega com os itens do pedido' : language === 'es' ? 'Crea una entrega con los ítems del pedido' : 'Create a delivery from order items'}
          >
            {language === 'pt' ? 'Criar entrega' : language === 'es' ? 'Crear entrega' : 'Create delivery'}
          </button>

          {/** Removed: Edit (modal) - we support inline edits on the details page. */}
        </div>
        </div>
      </header>

      {orderQ.isLoading ? (
        <p className="text-sm text-[var(--text-muted)]">Carregando...</p>
      ) : orderQ.isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Erro ao carregar: {String(orderQ.error)}
        </div>
      ) : !order ? (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">NOT_FOUND</div>
      ) : (
        <div className="grid gap-4">
          <section className="surface rounded-2xl border border-theme p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold text-[var(--foreground)]">{language === 'pt' ? 'Itens' : language === 'es' ? 'Ítems' : 'Items'}</h2>

                <div className="text-xs text-[var(--muted-foreground)]">
                  {language === 'pt' ? 'Desconto:' : language === 'es' ? 'Descuento:' : 'Discount:'}{' '}
                  <span className="font-medium text-[var(--foreground)]">
                    {(order.discountMode ?? 'SUBTOTAL') === 'PER_ITEM'
                      ? (language === 'pt' ? 'Por item' : language === 'es' ? 'Por ítem' : 'Per item')
                      : (language === 'pt' ? 'No total' : language === 'es' ? 'En el total' : 'On total')}
                  </span>
                </div>

                {editingDiscountMode ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={discountModeDraft}
                      onChange={(e) => setDiscountModeDraft(e.target.value as any)}
                      className="rounded-lg border border-theme bg-transparent px-3 py-2 text-sm"
                    >
                      <option value="SUBTOTAL">{language === 'pt' ? 'No total' : language === 'es' ? 'En el total' : 'On total'}</option>
                      <option value="PER_ITEM">{language === 'pt' ? 'Por item' : language === 'es' ? 'Por ítem' : 'Per item'}</option>
                    </select>

                    <button
                      type="button"
                      className="btn btn-primary btn-icon"
                      title={language === 'pt' ? 'Salvar' : language === 'es' ? 'Guardar' : 'Save'}
                      onClick={async () => {
                        try {
                          await patchOrderM.mutateAsync({ discountMode: discountModeDraft })
                          setEditingDiscountMode(false)
                        } catch (e: any) {
                          toastFailedToSave(i, String(e?.message ?? e ?? ''))
                        }
                      }}
                      disabled={patchOrderM.isPending}
                    >
                      <Save className="size-4" />
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary btn-icon"
                      title={language === 'pt' ? 'Cancelar' : language === 'es' ? 'Cancelar' : 'Cancel'}
                      onClick={() => {
                        setEditingDiscountMode(false)
                        setDiscountModeDraft(((order.discountMode ?? 'SUBTOTAL') as any) === 'PER_ITEM' ? 'PER_ITEM' : 'SUBTOTAL')
                      }}
                      disabled={patchOrderM.isPending}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn btn-secondary btn-icon"
                    title={language === 'pt' ? 'Alterar modo de desconto' : language === 'es' ? 'Cambiar modo de descuento' : 'Change discount mode'}
                    onClick={() => setEditingDiscountMode(true)}
                    disabled={!order}
                  >
                    <Pencil className="size-4" />
                  </button>
                )}
              </div>

              <div className="text-sm tabular-nums text-[var(--muted-foreground)]">
                {order.value == null ? '' : formatMoneyDisplay(order.value, moneyLocale, currency)}
              </div>
            </div>

            {order.reservationSummary && order.reservationSummary.reservedQtyTotal > 0 ? (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-900">
                {language === 'pt'
                  ? `${order.reservationSummary.reservedQtyTotal} itens reservados em estoque para este pedido`
                  : language === 'es'
                    ? `${order.reservationSummary.reservedQtyTotal} items reservados en inventario para este pedido`
                    : `${order.reservationSummary.reservedQtyTotal} items reserved in stock for this order`}
              </div>
            ) : null}

            {order.items?.length ? (
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
                    {order.items.map((it) => {
                      const isEditing = editingItemId === it.id

                      const qty = isEditing
                        ? Number(String(itemDraft?.quantity ?? '').replace(',', '.'))
                        : Number(String(it.quantity ?? '').replace(',', '.'))

                      const unitPrice = isEditing
                        ? (itemDraft?.unitPrice?.trim()
                            ? Number(String(itemDraft.unitPrice).replace(',', '.'))
                            : Number(it.unitPrice ?? 0))
                        : Number(it.unitPrice ?? 0)

                      const subtotal = (Number.isFinite(qty) ? Math.max(0, qty) : 0) * (Number.isFinite(unitPrice) ? Math.max(0, unitPrice) : 0)

                      const dv = isEditing ? (itemDraft?.discountValue?.trim() ? Number(String(itemDraft.discountValue).replace(',', '.')) : 0) : Number(it.discountValue ?? 0)
                      const dp = isEditing ? (itemDraft?.discountPercent?.trim() ? Number(String(itemDraft.discountPercent).replace(',', '.')) : 0) : Number(it.discountPercent ?? 0)

                      const perItemOn = (order.discountMode ?? 'SUBTOTAL') === 'PER_ITEM'

                      let disc = 0
                      if (perItemOn) {
                        if (dv > 0) disc = Math.max(0, dv)
                        else disc = (subtotal * Math.max(0, dp)) / 100
                        if (subtotal > 0) disc = Math.min(Math.max(0, subtotal - 0.01), disc)
                        else disc = 0
                      }

                      const total = Math.max(0, subtotal - disc)

                      return (
                        <tr key={it.id} className="border-t border-theme align-top">
                          <td className="py-2 pr-3">
                            {isEditing ? (
                              <div className="min-w-[260px]">
                                <SearchSelect
                                  value={{
                                    id: itemDraft?.productId ?? it.product.id,
                                    label:
                                      productLabelById.get(itemDraft?.productId ?? it.product.id) ??
                                      `${it.product.name} (${it.product.unit})`,
                                  }}
                                  onChange={(next) => setItemDraft((d) => (d ? { ...d, productId: next?.id ?? '' } : d))}
                                  minChars={2}
                                  labels={{
                                    placeholder: language === 'pt' ? 'Produto…' : language === 'es' ? 'Producto…' : 'Product…',
                                    hint:
                                      language === 'pt'
                                        ? 'Digite pelo menos 2 letras…'
                                        : language === 'es'
                                          ? 'Escribe 2+ letras…'
                                          : 'Type 2+ letters…',
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
                              </div>
                            ) : (
                              <div className="min-w-[260px]">
                                <div className="font-medium text-[var(--foreground)]">{it.product.name}</div>
                                {reservationByProductId.get(it.product.id)?.reservedQty ? (
                                  <div className="text-xs text-[var(--text-muted)]">
                                    {language === 'pt'
                                      ? `${reservationByProductId.get(it.product.id)?.reservedQty} reservado | ${reservationByProductId.get(it.product.id)?.unreservedQty} pendente`
                                      : language === 'es'
                                        ? `${reservationByProductId.get(it.product.id)?.reservedQty} reservado | ${reservationByProductId.get(it.product.id)?.unreservedQty} pendiente`
                                        : `${reservationByProductId.get(it.product.id)?.reservedQty} reserved | ${reservationByProductId.get(it.product.id)?.unreservedQty} pending`}
                                  </div>
                                ) : null}
                              </div>
                            )}
                          </td>

                          <td className="py-2 pr-3 text-right">
                            {isEditing ? (
                              <input
                                value={itemDraft?.quantity ?? ''}
                                onChange={(e) => setItemDraft((d) => (d ? { ...d, quantity: e.target.value } : d))}
                                className="w-24 rounded-lg border border-theme bg-transparent px-3 py-2 text-sm tabular-nums text-right"
                              />
                            ) : (
                              <span className="tabular-nums text-[var(--muted-foreground)]">{String(it.quantity)}</span>
                            )}
                          </td>

                          <td className="py-2 pr-3 text-[var(--muted-foreground)]">{it.product.unit}</td>

                          <td className="py-2 pr-3 text-right">
                            {isEditing ? (
                              <input
                                value={itemDraft?.unitPrice ?? ''}
                                onChange={(e) => setItemDraft((d) => (d ? { ...d, unitPrice: e.target.value } : d))}
                                className="w-28 rounded-lg border border-theme bg-transparent px-3 py-2 text-sm tabular-nums text-right"
                                inputMode="decimal"
                              />
                            ) : (
                              <span className="tabular-nums text-[var(--muted-foreground)]">{formatMoneyDisplay(it.unitPrice, moneyLocale, currency)}</span>
                            )}
                          </td>

                          <td className="py-2 pr-3 text-right tabular-nums text-[var(--muted-foreground)]">
                            {formatMoneyDisplay(subtotal, moneyLocale, currency)}
                          </td>

                          <td className="py-2 pr-3 text-right">
                            {isEditing ? (
                              <div className="flex justify-end gap-2">
                                <input
                                  value={itemDraft?.discountPercent ?? ''}
                                  onChange={(e) => setItemDraft((d) => (d ? { ...d, discountPercent: e.target.value } : d))}
                                  className="w-20 rounded-lg border border-theme bg-transparent px-3 py-2 text-sm tabular-nums text-right"
                                  inputMode="decimal"
                                  placeholder="%"
                                  disabled={!perItemOn}
                                />
                                <input
                                  value={itemDraft?.discountValue ?? ''}
                                  onChange={(e) => setItemDraft((d) => (d ? { ...d, discountValue: e.target.value } : d))}
                                  className="w-28 rounded-lg border border-theme bg-transparent px-3 py-2 text-sm tabular-nums text-right"
                                  inputMode="decimal"
                                  placeholder={language === 'pt' ? 'R$' : language === 'es' ? '$' : '$'}
                                  disabled={!perItemOn}
                                />
                              </div>
                            ) : (
                              <div className="flex justify-end gap-2 tabular-nums text-[var(--muted-foreground)]">
                                <span>{perItemOn && it.discountPercent != null ? `${String(it.discountPercent)}%` : '—'}</span>
                                <span>{perItemOn && it.discountValue != null ? formatMoneyDisplay(it.discountValue, moneyLocale, currency) : '—'}</span>
                              </div>
                            )}
                          </td>

                          <td className="py-2 pr-3 text-right tabular-nums text-[var(--muted-foreground)]">
                            {formatMoneyDisplay(total, moneyLocale, currency)}
                          </td>

                          <td className="py-2 text-right">
                            {isEditing ? (
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  className="btn btn-primary btn-icon"
                                  disabled={patchOrderM.isPending}
                                  onClick={async () => {
                                    try {
                                      if (!order || !itemDraft) return

                                      const nextItems = order.items.map((x) => {
                                        if (x.id !== it.id) {
                                          return {
                                            productId: x.product.id,
                                            quantity: Number(x.quantity),
                                            unitPrice: Number(x.unitPrice ?? 0),
                                            unit: x.product.unit,
                                            discountType: x.discountType ?? null,
                                            discountValue: x.discountValue == null ? null : Number(x.discountValue),
                                            discountPercent: x.discountPercent == null ? null : Number(x.discountPercent),
                                          }
                                        }

                                        const q2 = Number(String(itemDraft.quantity ?? '').replace(',', '.'))
                                        const up2 = Number(String(itemDraft.unitPrice ?? '').replace(',', '.'))
                                        const sub2 = (Number.isFinite(q2) ? Math.max(0, q2) : 0) * (Number.isFinite(up2) ? Math.max(0, up2) : 0)

                                        const dv2 = itemDraft.discountValue?.trim() ? Math.max(0, Number(String(itemDraft.discountValue).replace(',', '.'))) : 0
                                        const dp2 = itemDraft.discountPercent?.trim() ? Math.max(0, Number(String(itemDraft.discountPercent).replace(',', '.'))) : 0

                                        let discountType: any = null
                                        let discountValue: any = null
                                        let discountPercent: any = null

                                        if (perItemOn) {
                                          if (dv2 > 0) {
                                            discountType = 'VALUE'
                                            discountValue = dv2
                                          } else if (dp2 > 0) {
                                            discountType = 'PERCENT'
                                            discountPercent = dp2
                                          }

                                          // Validate (no zeroing)
                                          const disc2 = dv2 > 0 ? dv2 : (sub2 * dp2) / 100
                                          if (sub2 > 0 && disc2 >= sub2) {
                                            throw new Error(
                                              language === 'pt'
                                                ? 'O desconto do item não pode zerar o valor do item.'
                                                : language === 'es'
                                                  ? 'El descuento del ítem no puede dejar el valor en cero.'
                                                  : 'Item discount cannot zero the line.',
                                            )
                                          }
                                        }

                                        return {
                                          productId: itemDraft.productId,
                                          quantity: q2,
                                          unitPrice: up2,
                                          // Let the API normalize against the product base unit
                                          unit: null,
                                          discountType,
                                          discountValue,
                                          discountPercent,
                                        }
                                      })

                                      await patchOrderM.mutateAsync({ items: nextItems })
                                      setEditingItemId(null)
                                      setItemDraft(null)
                                    } catch (e: any) {
                                      toastFailedToSave(i, String(e?.message ?? e ?? ''))
                                    }
                                  }}
                                  title={language === 'pt' ? 'Salvar' : language === 'es' ? 'Guardar' : 'Save'}
                                >
                                  <Save className="size-4" />
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-icon"
                                  disabled={patchOrderM.isPending}
                                  onClick={() => {
                                    setEditingItemId(null)
                                    setItemDraft(null)
                                  }}
                                  title={language === 'pt' ? 'Cancelar' : language === 'es' ? 'Cancelar' : 'Cancel'}
                                >
                                  <X className="size-4" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-secondary btn-icon"
                                onClick={() => {
                                  setEditingItemId(it.id)
                                  setItemDraft({
                                    productId: it.product.id,
                                    quantity: String(it.quantity ?? ''),
                                    unitPrice: String(it.unitPrice ?? ''),
                                    discountPercent: String(it.discountPercent ?? ''),
                                    discountValue: String(it.discountValue ?? ''),
                                  })
                                }}
                                title={language === 'pt' ? 'Editar linha' : language === 'es' ? 'Editar línea' : 'Edit line'}
                              >
                                <Pencil className="size-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-3 text-sm text-[var(--muted-foreground)]">—</div>
            )}
          </section>

          <section className="surface rounded-2xl border border-theme p-4">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">{language === 'pt' ? 'Entregas' : language === 'es' ? 'Entregas' : 'Deliveries'}</h2>
            <div className="mt-3 space-y-2">
              {(deliveriesQ.data?.deliveries ?? []).length ? (
                (deliveriesQ.data?.deliveries ?? []).map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-3 rounded-lg border border-theme px-3 py-2">
                    <div className="min-w-0">
                      <Link className="truncate text-sm font-medium text-[var(--foreground)] underline" href={`/app/deliveries/${d.id}`}>{d.id}</Link>
                      <div className="text-xs text-[var(--muted-foreground)]">
                        {language === 'pt' ? 'Status' : language === 'es' ? 'Estado' : 'Status'}: {d.status}
                        {d.value != null ? ` • ${formatMoneyDisplay(d.value, moneyLocale, currency)}` : ''}
                      </div>
                    </div>
                    <span className="text-xs text-[var(--muted-foreground)]" title={language === 'pt' ? 'Tela em construção' : language === 'es' ? 'Pantalla en construcción' : 'Page under construction'}>
                      {language === 'pt' ? 'Financeiro: em breve' : language === 'es' ? 'Finanzas: pronto' : 'Finance: soon'}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-sm text-[var(--muted-foreground)]">—</div>
              )}
            </div>
          </section>

          <section className="surface rounded-2xl border border-theme p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-[var(--foreground)]">{language === 'pt' ? 'Recebíveis' : language === 'es' ? 'Por cobrar' : 'Receivables'}</h2>
              <span
                className="text-xs text-[var(--muted-foreground)]"
                title={language === 'pt' ? 'Tela em construção' : language === 'es' ? 'Pantalla en construcción' : 'Page under construction'}
              >
                {language === 'pt' ? 'Financeiro: em breve' : language === 'es' ? 'Finanzas: pronto' : 'Finance: soon'}
              </span>
            </div>

            <div className="mt-2 text-sm tabular-nums text-[var(--muted-foreground)]">
              {(() => {
                const total = (receivablesQ.data?.receivables ?? []).reduce((acc, r) => acc + Number(r.value ?? 0), 0)
                return total > 0 ? formatMoneyDisplay(total, moneyLocale, currency) : ''
              })()}
            </div>

            <div className="mt-3 space-y-2">
              {(receivablesQ.data?.receivables ?? []).length ? (
                (receivablesQ.data?.receivables ?? []).map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-theme px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-[var(--foreground)]">{r.id}</div>
                      <div className="text-xs text-[var(--muted-foreground)]">
                        {language === 'pt' ? 'Status' : language === 'es' ? 'Estado' : 'Status'}: {r.status}
                      </div>
                    </div>
                    <div className="text-sm tabular-nums text-[var(--muted-foreground)]">
                      {formatMoneyDisplay(r.value, moneyLocale, currency)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-[var(--muted-foreground)]">—</div>
              )}
            </div>
          </section>

          <AuditHistory entityType="SalesOrder" entityId={id ?? ''} />

          <section className="surface rounded-2xl border border-theme p-4">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">{language === 'pt' ? 'Controle' : language === 'es' ? 'Control' : 'Control'}</h2>
            <div className="mt-3 grid gap-2 text-sm text-[var(--muted-foreground)] sm:grid-cols-2">
              <div>
                <span className="font-medium text-[var(--foreground)]">{language === 'pt' ? 'Criado em' : language === 'es' ? 'Creado en' : 'Created at'}:</span>{' '}
                {new Date(order.createdAt).toLocaleString()}
              </div>
              <div>
                <span className="font-medium text-[var(--foreground)]">{language === 'pt' ? 'Atualizado em' : language === 'es' ? 'Actualizado en' : 'Updated at'}:</span>{' '}
                {new Date(order.updatedAt).toLocaleString()}
              </div>
              <div>
                <span className="font-medium text-[var(--foreground)]">{language === 'pt' ? 'Criado por' : language === 'es' ? 'Creado por' : 'Created by'}:</span>{' '}
                {order.createdById ?? '—'}
              </div>
              <div>
                <span className="font-medium text-[var(--foreground)]">{language === 'pt' ? 'Atualizado por' : language === 'es' ? 'Actualizado por' : 'Updated by'}:</span>{' '}
                {order.updatedById ?? '—'}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
