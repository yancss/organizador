'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/app/app/api-client'
import { toastCreated, toastFailedToSave } from '@/app/app/toast'
import { useSettings } from '@/app/app/settings-context'
import { t } from '@/app/app/i18n'
import { formatMoneyDisplay, localeFromLanguage } from '@/app/app/money'

type Order = {
  id: string
  code: string | null
  name: string
  observations: string | null
  orderedAt: string | null
  deliveryAt: string | null
  status: string
  value: string | number | null
  client: { id: string; name: string } | null
  items: Array<{
    id: string
    quantity: string | number
    unitPrice: string | number
    product: { id: string; name: string; unit: string }
  }>
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

export default function SalesOrderDetailsPage() {
  const qc = useQueryClient()

  const params = useParams<{ id: string }>()
  const id = params?.id

  const { language, currency } = useSettings()
  const i = t(language)
  const moneyLocale = localeFromLanguage(language)

  const orderQ = useQuery({
    queryKey: ['order', id],
    enabled: !!id,
    queryFn: () => api<{ order: Order }>(`/api/orders/${id}`),
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

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="text-sm text-[var(--muted-foreground)]">
            <Link href="/app/sales/orders" className="underline">
              {language === 'pt' ? 'Voltar' : language === 'es' ? 'Volver' : 'Back'}
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">
              {order?.name ?? (language === 'pt' ? 'Pedido' : language === 'es' ? 'Pedido' : 'Order')}
            </h1>
            {order?.code ? <span className="badge badge-muted">{order.code}</span> : null}
            {order?.status ? <span className="badge badge-solid">{order.status}</span> : null}
          </div>

          <div className="grid gap-1 text-sm text-neutral-600">
            <div>
              {order?.client?.name
                ? `${i.orders.client}: ${order.client.name}`
                : `${i.orders.client}: ${i.orders.noClient}`}
            </div>
            <div>
              {language === 'pt' ? 'Pedido em' : language === 'es' ? 'Pedido en' : 'Ordered at'}:{' '}
              {order?.orderedAt ? new Date(order.orderedAt).toLocaleString() : '—'}
            </div>
            <div>
              {language === 'pt' ? 'Entrega prevista' : language === 'es' ? 'Entrega prevista' : 'Delivery at'}:{' '}
              {order?.deliveryAt ? new Date(order.deliveryAt).toLocaleString() : '—'}
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

          {id ? (
            <Link href={`/app/sales/orders?edit=${id}`} className="btn btn-secondary">
              {language === 'pt' ? 'Editar (modal)' : language === 'es' ? 'Editar (modal)' : 'Edit (modal)'}
            </Link>
          ) : null}
        </div>
      </header>

      {orderQ.isLoading ? (
        <p className="text-sm text-neutral-600">Carregando…</p>
      ) : orderQ.isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Erro ao carregar: {String(orderQ.error)}
        </div>
      ) : !order ? (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">NOT_FOUND</div>
      ) : (
        <div className="grid gap-4">
          <section className="surface rounded-xl border border-theme p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-[var(--foreground)]">{language === 'pt' ? 'Itens' : language === 'es' ? 'Ítems' : 'Items'}</h2>
              <div className="text-sm tabular-nums text-[var(--muted-foreground)]">
                {order.value == null ? '' : formatMoneyDisplay(order.value, moneyLocale, currency)}
              </div>
            </div>

            {order.items?.length ? (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-[var(--muted-foreground)]">
                      <th className="py-2 pr-3">{language === 'pt' ? 'Produto' : language === 'es' ? 'Producto' : 'Product'}</th>
                      <th className="py-2 pr-3">{language === 'pt' ? 'Qtd.' : language === 'es' ? 'Cant.' : 'Qty'}</th>
                      <th className="py-2 pr-3">{language === 'pt' ? 'Unid.' : language === 'es' ? 'Unid.' : 'Unit'}</th>
                      <th className="py-2 text-right">{language === 'pt' ? 'Valor' : language === 'es' ? 'Valor' : 'Price'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((it) => (
                      <tr key={it.id} className="border-t border-theme">
                        <td className="py-2 pr-3 font-medium text-[var(--foreground)]">{it.product.name}</td>
                        <td className="py-2 pr-3 tabular-nums text-[var(--muted-foreground)]">{String(it.quantity)}</td>
                        <td className="py-2 pr-3 text-[var(--muted-foreground)]">{it.product.unit}</td>
                        <td className="py-2 text-right tabular-nums text-[var(--muted-foreground)]">
                          {formatMoneyDisplay(it.unitPrice, moneyLocale, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-3 text-sm text-[var(--muted-foreground)]">—</div>
            )}
          </section>

          <section className="surface rounded-xl border border-theme p-4">
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

          <section className="surface rounded-xl border border-theme p-4">
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

          <section className="surface rounded-xl border border-theme p-4">
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
