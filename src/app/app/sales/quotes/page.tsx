'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '../../api-client'
import { useSettings } from '../../settings-context'
import { toast } from '../../toast'
import { formatMoneyDisplay, localeFromLanguage } from '../../money'

type QuoteStatus = 'DRAFT' | 'SENT' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CONVERTED' | 'CANCELLED'

type QuoteItem = {
  id: string
  quantity: string | number
  unitPrice: string | number
  product: { id: string; name: string; unit: string }
}

type Quote = {
  id: string
  code: string | null
  name: string
  status: QuoteStatus
  validUntil: string | null
  value: string | number | null
  discountMode: 'SUBTOTAL' | 'PER_ITEM'
  discountType: 'VALUE' | 'PERCENT' | null
  discountValue: string | number | null
  discountPercent: string | number | null
  client: { id: string; name: string } | null
  items: QuoteItem[]
  salesOrder: { id: string; code: string | null; status: string } | null
  createdAt: string
}

type Product = { id: string; name: string; unit: string }
type Client = { id: string; name: string }

function copy(language: string) {
  const pt = {
    title: 'Orçamentos',
    subtitle: 'Propostas comerciais antes do pedido. Aprovado, converte em pedido de venda.',
    newQuote: 'Novo orçamento',
    settings: 'Configurações',
    name: 'Nome / referência',
    client: 'Cliente',
    validUntil: 'Válido até',
    items: 'Itens',
    product: 'Produto',
    qty: 'Qtd.',
    price: 'Preço unit.',
    addItem: 'Adicionar item',
    discountPct: 'Desconto (%)',
    total: 'Total',
    save: 'Salvar',
    cancel: 'Cancelar',
    edit: 'Editar',
    reopen: 'Reabrir',
    send: 'Enviar',
    approve: 'Aprovar',
    reject: 'Rejeitar',
    expire: 'Marcar expirado',
    convert: 'Converter em pedido',
    remove: 'Excluir',
    status: 'Status',
    code: 'Código',
    order: 'Pedido',
    empty: 'Nenhum orçamento ainda.',
    loading: 'Carregando...',
    saved: 'Orçamento salvo',
    error: 'Não foi possível concluir',
    approvalRequired: 'Desconto acima da política — enviado para aprovação',
    expired: 'vencido',
    pickClient: 'Selecione um cliente',
    pickProduct: 'Selecione um produto',
  }
  const es: typeof pt = {
    title: 'Presupuestos',
    subtitle: 'Propuestas comerciales antes del pedido. Aprobado, se convierte en pedido de venta.',
    newQuote: 'Nuevo presupuesto',
    settings: 'Configuración',
    name: 'Nombre / referencia',
    client: 'Cliente',
    validUntil: 'Válido hasta',
    items: 'Ítems',
    product: 'Producto',
    qty: 'Cant.',
    price: 'Precio unit.',
    addItem: 'Agregar ítem',
    discountPct: 'Descuento (%)',
    total: 'Total',
    save: 'Guardar',
    cancel: 'Cancelar',
    edit: 'Editar',
    reopen: 'Reabrir',
    send: 'Enviar',
    approve: 'Aprobar',
    reject: 'Rechazar',
    expire: 'Marcar vencido',
    convert: 'Convertir en pedido',
    remove: 'Eliminar',
    status: 'Estado',
    code: 'Código',
    order: 'Pedido',
    empty: 'Aún no hay presupuestos.',
    loading: 'Cargando...',
    saved: 'Presupuesto guardado',
    error: 'No se pudo completar',
    approvalRequired: 'Descuento sobre la política — enviado a aprobación',
    expired: 'vencido',
    pickClient: 'Selecciona un cliente',
    pickProduct: 'Selecciona un producto',
  }
  const en: typeof pt = {
    title: 'Quotes',
    subtitle: 'Commercial proposals before the order. Once approved, converts into a sales order.',
    newQuote: 'New quote',
    settings: 'Settings',
    name: 'Name / reference',
    client: 'Client',
    validUntil: 'Valid until',
    items: 'Items',
    product: 'Product',
    qty: 'Qty',
    price: 'Unit price',
    addItem: 'Add item',
    discountPct: 'Discount (%)',
    total: 'Total',
    save: 'Save',
    cancel: 'Cancel',
    edit: 'Edit',
    reopen: 'Reopen',
    send: 'Send',
    approve: 'Approve',
    reject: 'Reject',
    expire: 'Mark expired',
    convert: 'Convert to order',
    remove: 'Delete',
    status: 'Status',
    code: 'Code',
    order: 'Order',
    empty: 'No quotes yet.',
    loading: 'Loading...',
    saved: 'Quote saved',
    error: 'Could not complete',
    approvalRequired: 'Discount above policy — sent for approval',
    expired: 'expired',
    pickClient: 'Select a client',
    pickProduct: 'Select a product',
  }
  return language === 'pt' ? pt : language === 'es' ? es : en
}

function statusLabel(s: QuoteStatus, language: string) {
  const map: Record<QuoteStatus, [string, string, string]> = {
    DRAFT: ['Rascunho', 'Borrador', 'Draft'],
    SENT: ['Enviado', 'Enviado', 'Sent'],
    APPROVED: ['Aprovado', 'Aprobado', 'Approved'],
    REJECTED: ['Rejeitado', 'Rechazado', 'Rejected'],
    EXPIRED: ['Expirado', 'Vencido', 'Expired'],
    CONVERTED: ['Convertido', 'Convertido', 'Converted'],
    CANCELLED: ['Cancelado', 'Cancelado', 'Cancelled'],
  }
  const [pt, es, en] = map[s]
  return language === 'pt' ? pt : language === 'es' ? es : en
}

function statusClass(s: QuoteStatus) {
  switch (s) {
    case 'APPROVED':
      return 'bg-green-100 text-green-800'
    case 'CONVERTED':
      return 'bg-blue-100 text-blue-800'
    case 'REJECTED':
    case 'CANCELLED':
      return 'bg-red-100 text-red-800'
    case 'EXPIRED':
      return 'bg-amber-100 text-amber-800'
    case 'SENT':
      return 'bg-indigo-100 text-indigo-800'
    default:
      return 'bg-neutral-100 text-neutral-700'
  }
}

type DraftItem = { productId: string; quantity: string; unitPrice: string }
type Draft = {
  id?: string
  name: string
  clientId: string
  validUntil: string
  discountPercent: string
  items: DraftItem[]
}

const emptyDraft: Draft = { name: '', clientId: '', validUntil: '', discountPercent: '', items: [{ productId: '', quantity: '1', unitPrice: '0' }] }

const inputCls = 'h-10 w-full rounded-md border border-theme bg-transparent px-3 text-sm'

export default function SalesQuotesPage() {
  const { language, currency } = useSettings()
  const c = copy(language)
  const moneyLocale = localeFromLanguage(language)
  const qc = useQueryClient()
  const [draft, setDraft] = useState<Draft | null>(null)

  const listQ = useQuery({
    queryKey: ['quotes'],
    queryFn: () => api<{ quotes: Quote[] }>('/api/quotes?take=100'),
  })
  const meQ = useQuery({
    queryKey: ['me'],
    queryFn: () => api<{ workspace?: { role?: 'USER' | 'ADMIN'; isSuperadmin?: boolean } }>('/api/me'),
  })
  const isAdmin = Boolean(meQ.data?.workspace?.isSuperadmin) || meQ.data?.workspace?.role === 'ADMIN'
  const productsQ = useQuery({ queryKey: ['quote-products'], queryFn: () => api<{ products: Product[] }>('/api/products?kind=FINISHED&take=200') })
  const clientsQ = useQuery({ queryKey: ['quote-clients'], queryFn: () => api<{ clients: Client[] }>('/api/clients?take=200') })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['quotes'] })

  const saveM = useMutation({
    mutationFn: async (d: Draft) => {
      const payload = {
        name: d.name.trim(),
        clientId: d.clientId,
        validUntil: d.validUntil ? new Date(d.validUntil + 'T00:00:00.000Z').toISOString() : null,
        discountMode: 'SUBTOTAL' as const,
        discountType: d.discountPercent ? ('PERCENT' as const) : null,
        discountPercent: d.discountPercent ? Number(d.discountPercent) : null,
        items: d.items
          .filter((it) => it.productId && Number(it.quantity) > 0)
          .map((it) => ({ productId: it.productId, quantity: Number(it.quantity), unitPrice: Number(it.unitPrice) })),
      }
      if (d.id) return api(`/api/quotes/${d.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
      return api('/api/quotes', { method: 'POST', body: JSON.stringify(payload) })
    },
    onSuccess: () => {
      toast.success(c.saved)
      setDraft(null)
      void invalidate()
    },
    onError: () => toast.error(c.error),
  })

  const statusM = useMutation({
    mutationFn: ({ id, status }: { id: string; status: QuoteStatus }) =>
      api(`/api/quotes/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => void invalidate(),
    onError: async (e: any) => {
      const msg = String(e?.message ?? '')
      if (msg.includes('APPROVAL_REQUIRED')) {
        toast.success(c.approvalRequired)
        void invalidate()
        void qc.invalidateQueries({ queryKey: ['approvals'] })
      } else {
        toast.error(c.error)
      }
    },
  })

  const convertM = useMutation({
    mutationFn: (id: string) => api(`/api/quotes/${id}/convert`, { method: 'POST' }),
    onSuccess: () => {
      toast.success(c.saved)
      void invalidate()
    },
    onError: () => toast.error(c.error),
  })

  const delM = useMutation({
    mutationFn: (id: string) => api(`/api/quotes/${id}`, { method: 'DELETE' }),
    onSuccess: () => void invalidate(),
    onError: () => toast.error(c.error),
  })

  const rows = listQ.data?.quotes ?? []
  const products = productsQ.data?.products ?? []
  const clients = clientsQ.data?.clients ?? []
  const today = new Date().toISOString().slice(0, 10)

  const draftTotal = useMemo(() => {
    if (!draft) return 0
    const sub = draft.items.reduce((a, it) => a + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0)
    const disc = draft.discountPercent ? (sub * Math.min(100, Math.max(0, Number(draft.discountPercent)))) / 100 : 0
    return Math.max(0, sub - disc)
  }, [draft])

  function openEdit(q: Quote) {
    setDraft({
      id: q.id,
      name: q.name,
      clientId: q.client?.id ?? '',
      validUntil: q.validUntil ? q.validUntil.slice(0, 10) : '',
      discountPercent: q.discountPercent != null ? String(q.discountPercent) : '',
      items: q.items.length
        ? q.items.map((it) => ({ productId: it.product.id, quantity: String(it.quantity), unitPrice: String(it.unitPrice) }))
        : [{ productId: '', quantity: '1', unitPrice: '0' }],
    })
  }

  const canSave = draft && draft.name.trim() && draft.clientId && draft.items.some((it) => it.productId && Number(it.quantity) > 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{c.title}</h1>
          <p className="text-sm text-[var(--text-muted)]">{c.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin ? (
            <Link className="btn btn-secondary btn-sm" href="/app/admin/settings">
              ⚙ {c.settings}
            </Link>
          ) : null}
          {!draft ? (
            <button className="btn btn-primary btn-sm" onClick={() => setDraft({ ...emptyDraft })}>
              {c.newQuote}
            </button>
          ) : null}
        </div>
      </div>

      {draft ? (
        <div className="surface rounded-2xl border border-theme p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-medium">
              {c.name}
              <input className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </label>
            <label className="text-xs font-medium">
              {c.client}
              <select className={inputCls} value={draft.clientId} onChange={(e) => setDraft({ ...draft, clientId: e.target.value })}>
                <option value="">{c.pickClient}</option>
                {clients.map((cl) => (
                  <option key={cl.id} value={cl.id}>
                    {cl.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium">
              {c.validUntil}
              <input type="date" className={inputCls} value={draft.validUntil} onChange={(e) => setDraft({ ...draft, validUntil: e.target.value })} />
            </label>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{c.items}</div>
            {draft.items.map((it, idx) => (
              <div key={idx} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_90px_120px_auto]">
                <select
                  className={inputCls}
                  value={it.productId}
                  onChange={(e) => {
                    const items = [...draft.items]
                    items[idx] = { ...it, productId: e.target.value }
                    setDraft({ ...draft, items })
                  }}
                >
                  <option value="">{c.pickProduct}</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <input
                  className={inputCls}
                  type="number"
                  min={0}
                  value={it.quantity}
                  onChange={(e) => {
                    const items = [...draft.items]
                    items[idx] = { ...it, quantity: e.target.value }
                    setDraft({ ...draft, items })
                  }}
                />
                <input
                  className={inputCls}
                  type="number"
                  min={0}
                  step="0.01"
                  value={it.unitPrice}
                  onChange={(e) => {
                    const items = [...draft.items]
                    items[idx] = { ...it, unitPrice: e.target.value }
                    setDraft({ ...draft, items })
                  }}
                />
                <button
                  className="btn btn-secondary btn-sm"
                  type="button"
                  onClick={() => setDraft({ ...draft, items: draft.items.filter((_, i) => i !== idx) })}
                  disabled={draft.items.length <= 1}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              onClick={() => setDraft({ ...draft, items: [...draft.items, { productId: '', quantity: '1', unitPrice: '0' }] })}
            >
              {c.addItem}
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium">
              {c.discountPct}
              <input
                className={inputCls}
                type="number"
                min={0}
                max={100}
                value={draft.discountPercent}
                onChange={(e) => setDraft({ ...draft, discountPercent: e.target.value })}
              />
            </label>
            <div className="flex items-end justify-end text-sm">
              <span className="text-[var(--text-muted)] mr-2">{c.total}:</span>
              <span className="font-semibold">{formatMoneyDisplay(draftTotal, moneyLocale, currency)}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button className="btn btn-primary btn-sm" disabled={!canSave || saveM.isPending} onClick={() => draft && saveM.mutate(draft)}>
              {c.save}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setDraft(null)}>
              {c.cancel}
            </button>
          </div>
        </div>
      ) : null}

      <div className="surface overflow-x-auto rounded-2xl border border-theme">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-theme text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
              <th className="px-3 py-2">{c.code}</th>
              <th className="px-3 py-2">{c.name}</th>
              <th className="px-3 py-2">{c.client}</th>
              <th className="px-3 py-2">{c.status}</th>
              <th className="px-3 py-2">{c.validUntil}</th>
              <th className="px-3 py-2 text-right">{c.total}</th>
              <th className="px-3 py-2">{c.order}</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {listQ.isLoading ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-[var(--text-muted)]">
                  {c.loading}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-[var(--text-muted)]">
                  {c.empty}
                </td>
              </tr>
            ) : (
              rows.map((q) => {
                const overdue = q.validUntil && q.validUntil.slice(0, 10) < today && (q.status === 'SENT' || q.status === 'DRAFT')
                return (
                  <tr key={q.id} className="border-b border-theme/60">
                    <td className="px-3 py-2 font-mono text-xs">{q.code ?? '—'}</td>
                    <td className="px-3 py-2">{q.name}</td>
                    <td className="px-3 py-2">{q.client?.name ?? '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-md px-2 py-0.5 text-xs ${statusClass(q.status)}`}>{statusLabel(q.status, language)}</span>
                    </td>
                    <td className="px-3 py-2">
                      {q.validUntil ? (
                        <span className={overdue ? 'text-amber-700' : ''}>
                          {q.validUntil.slice(0, 10)}
                          {overdue ? ` (${c.expired})` : ''}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">{q.value != null ? formatMoneyDisplay(q.value, moneyLocale, currency) : '—'}</td>
                    <td className="px-3 py-2">
                      {q.salesOrder ? (
                        <Link className="text-[var(--primary)] underline" href={`/app/sales/orders/${q.salesOrder.id}`}>
                          {q.salesOrder.code ?? q.salesOrder.id.slice(0, 8)}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap justify-end gap-1">
                        {q.status === 'DRAFT' ? (
                          <>
                            <button className="btn btn-secondary btn-sm" onClick={() => openEdit(q)}>
                              {c.edit}
                            </button>
                            <button className="btn btn-primary btn-sm" onClick={() => statusM.mutate({ id: q.id, status: 'SENT' })}>
                              {c.send}
                            </button>
                            <button className="btn btn-danger-soft btn-sm" onClick={() => delM.mutate(q.id)}>
                              {c.remove}
                            </button>
                          </>
                        ) : null}
                        {q.status === 'SENT' ? (
                          <>
                            <button className="btn btn-primary btn-sm" onClick={() => statusM.mutate({ id: q.id, status: 'APPROVED' })}>
                              {c.approve}
                            </button>
                            <button className="btn btn-danger-soft btn-sm" onClick={() => statusM.mutate({ id: q.id, status: 'REJECTED' })}>
                              {c.reject}
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={() => statusM.mutate({ id: q.id, status: 'EXPIRED' })}>
                              {c.expire}
                            </button>
                          </>
                        ) : null}
                        {q.status === 'APPROVED' ? (
                          <button className="btn btn-primary btn-sm" disabled={convertM.isPending} onClick={() => convertM.mutate(q.id)}>
                            {c.convert}
                          </button>
                        ) : null}
                        {(q.status === 'REJECTED' || q.status === 'EXPIRED') && isAdmin ? (
                          <button className="btn btn-secondary btn-sm" onClick={() => statusM.mutate({ id: q.id, status: 'DRAFT' })}>
                            {c.reopen}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
