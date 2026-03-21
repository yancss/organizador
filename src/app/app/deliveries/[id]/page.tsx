'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '../../api-client'
import { toastUpdated, toastFailedToSave } from '../../toast'
import { useSettings } from '../../settings-context'
import { t } from '../../i18n'
import { formatMoneyDisplay, localeFromLanguage, parseMoneyToNumber, formatMoneyFromNumber } from '../../money'

type Delivery = {
  id: string
  salesOrderId: string
  clientId: string | null
  status: string
  method: 'DELIVERY' | 'PICKUP'
  plannedAt: string | null
  shippedAt: string | null
  deliveredAt: string | null
  carrier: string | null
  trackingCode: string | null
  trackingUrl: string | null
  observations: string | null
  value: string | number | null

  addressCountry: string | null
  addressPostalCode: string | null
  addressState: string | null
  addressCity: string | null
  addressDistrict: string | null
  addressStreet: string | null
  addressNumber: string | null
  addressComplement: string | null
  addressNotes: string | null

  receivable: { id: string; status: string; value: string | number } | null
  items: Array<{ id: string; quantity: string | number; product: { id: string; name: string; unit: string } }>

  createdAt: string
  updatedAt: string
}

export default function DeliveryDetailsPage() {
  const qc = useQueryClient()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id

  const { language, currency } = useSettings()
  const i = t(language)
  const moneyLocale = localeFromLanguage(language)

  const q = useQuery({
    queryKey: ['delivery', id],
    enabled: !!id,
    queryFn: () => api<{ delivery: Delivery }>(`/api/deliveries/${id}`),
  })

  const delivery = q.data?.delivery

  const patchM = useMutation({
    mutationFn: async (payload: any) =>
      api<{ delivery: Delivery }>(`/api/deliveries/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      toastUpdated(i, 'delivery')
      await qc.invalidateQueries({ queryKey: ['deliveries'] })
      if (id) await qc.invalidateQueries({ queryKey: ['delivery', id] })
    },
    onError: (e: any) => toastFailedToSave(i, String(e?.message ?? e ?? '')),
  })

  const shipM = useMutation({
    mutationFn: async () =>
      api<{ delivery: Delivery }>(`/api/deliveries/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'SHIPPED', shippedAt: new Date().toISOString() }),
      }),
    onSuccess: async () => {
      toastUpdated(i, 'delivery')
      await qc.invalidateQueries({ queryKey: ['deliveries'] })
      if (id) await qc.invalidateQueries({ queryKey: ['delivery', id] })
    },
    onError: (e: any) => toastFailedToSave(i, String(e?.message ?? e ?? '')),
  })

  if (q.isLoading) return <p className="text-sm text-neutral-600">Carregando…</p>
  if (q.isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Erro ao carregar: {String(q.error)}
      </div>
    )
  }
  if (!delivery) return <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm">NOT_FOUND</div>

  const valueNumber = delivery.value == null ? null : Number(delivery.value)

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="text-sm text-[var(--muted-foreground)]">
            <Link href="/app/deliveries" className="underline">
              {language === 'pt' ? 'Voltar' : language === 'es' ? 'Volver' : 'Back'}
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">
              {language === 'pt' ? 'Entrega' : language === 'es' ? 'Entrega' : 'Delivery'}
            </h1>
            <span className="badge badge-muted">{delivery.id.slice(0, 8)}…</span>
            <span className="badge badge-solid">{delivery.status}</span>
          </div>

          <div className="text-sm text-neutral-600">
            PV: <Link className="underline" href={`/app/sales/orders/${delivery.salesOrderId}`}>{delivery.salesOrderId.slice(0, 8)}…</Link>
            {valueNumber != null ? ` • ${formatMoneyDisplay(valueNumber, moneyLocale, currency)}` : ''}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:justify-end">
          <button className="btn btn-secondary" type="button" onClick={() => shipM.mutate()} disabled={shipM.isPending}>
            {language === 'pt' ? 'Marcar como SHIPPED' : language === 'es' ? 'Marcar como SHIPPED' : 'Mark as SHIPPED'}
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => router.push(`/app/sales/orders/${delivery.salesOrderId}`)}
          >
            {language === 'pt' ? 'Ver pedido' : language === 'es' ? 'Ver pedido' : 'View order'}
          </button>
        </div>
      </header>

      <section className="surface rounded-xl border border-theme p-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-xs font-medium text-[var(--foreground)]">{language === 'pt' ? 'Método' : language === 'es' ? 'Método' : 'Method'}</span>
            <select
              className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
              value={delivery.method}
              onChange={(e) => patchM.mutate({ method: e.target.value })}
              disabled={patchM.isPending}
            >
              <option value="PICKUP">{language === 'pt' ? 'Retirada (cliente busca)' : language === 'es' ? 'Retiro (cliente recoge)' : 'Pickup'}</option>
              <option value="DELIVERY">{language === 'pt' ? 'Entrega (endereço)' : language === 'es' ? 'Entrega (dirección)' : 'Delivery'}</option>
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-medium text-[var(--foreground)]">{language === 'pt' ? 'Valor' : language === 'es' ? 'Valor' : 'Value'}</span>
            <input
              className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
              defaultValue={valueNumber == null ? '' : formatMoneyFromNumber(valueNumber, moneyLocale)}
              onBlur={(e) => {
                const n = parseMoneyToNumber(e.target.value, moneyLocale)
                patchM.mutate({ value: n == null ? null : n })
              }}
              placeholder={language === 'pt' ? 'Opcional' : language === 'es' ? 'Opcional' : 'Optional'}
            />
          </label>
        </div>

        {delivery.method === 'DELIVERY' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1">
              <span className="text-xs font-medium text-[var(--foreground)]">Cidade *</span>
              <input
                className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                defaultValue={delivery.addressCity ?? ''}
                onBlur={(e) => patchM.mutate({ addressCity: e.target.value || null })}
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs font-medium text-[var(--foreground)]">Rua *</span>
              <input
                className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                defaultValue={delivery.addressStreet ?? ''}
                onBlur={(e) => patchM.mutate({ addressStreet: e.target.value || null })}
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs font-medium text-[var(--foreground)]">Número</span>
              <input
                className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                defaultValue={delivery.addressNumber ?? ''}
                onBlur={(e) => patchM.mutate({ addressNumber: e.target.value || null })}
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs font-medium text-[var(--foreground)]">Complemento</span>
              <input
                className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                defaultValue={delivery.addressComplement ?? ''}
                onBlur={(e) => patchM.mutate({ addressComplement: e.target.value || null })}
              />
            </label>

            <label className="grid gap-1 sm:col-span-2">
              <span className="text-xs font-medium text-[var(--foreground)]">Observações do endereço</span>
              <input
                className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                defaultValue={delivery.addressNotes ?? ''}
                onBlur={(e) => patchM.mutate({ addressNotes: e.target.value || null })}
                placeholder={language === 'pt' ? 'Ex.: portaria, referência, horário…' : language === 'es' ? 'Ej.: portería, referencia, horario…' : 'E.g. reception, reference, schedule…'}
              />
            </label>

            <div className="text-xs text-[var(--muted-foreground)] sm:col-span-2">
              * Obrigatório quando o método for Entrega.
            </div>
          </div>
        ) : (
          <div className="text-sm text-[var(--muted-foreground)]">
            {language === 'pt'
              ? 'Retirada selecionada: endereço não é obrigatório.'
              : language === 'es'
                ? 'Retiro seleccionado: la dirección no es obligatoria.'
                : 'Pickup selected: address is not required.'}
          </div>
        )}
      </section>

      <section className="surface rounded-xl border border-theme p-4">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">{language === 'pt' ? 'Itens' : language === 'es' ? 'Ítems' : 'Items'}</h2>
        <div className="mt-3 space-y-2">
          {delivery.items.length ? (
            delivery.items.map((it) => (
              <div key={it.id} className="flex items-center justify-between gap-3 rounded-lg border border-theme px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-[var(--foreground)]">{it.product.name}</div>
                  <div className="text-xs text-[var(--muted-foreground)]">
                    {String(it.quantity)} {it.product.unit}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-[var(--muted-foreground)]">—</div>
          )}
        </div>
      </section>
    </div>
  )
}
