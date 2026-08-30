'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '../../api-client'
import { toastUpdated, toastFailedToSave } from '../../toast'
import { useSettings } from '../../settings-context'
import { t } from '../../i18n'
import { formatMoneyDisplay, localeFromLanguage, parseMoneyToNumber, formatMoneyFromNumber } from '../../money'
import { EntityFieldsSection } from '../../entity-fields-section'

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

type InventoryLotOption = {
  id: string
  lotCode: string
  expiresAt: string | null
  serialCodes?: string[]
  quantity: string | number
  warehouseId?: string | null
  warehouseName?: string | null
}

export default function DeliveryDetailsPage() {
  const qc = useQueryClient()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id

  const { language, currency } = useSettings()
  const i = t(language)
  const moneyLocale = localeFromLanguage(language)
  const [shipModalOpen, setShipModalOpen] = useState(false)
  const [lotSelections, setLotSelections] = useState<Record<string, { lotId: string; quantity: string; serialCodesText: string }>>({})

  const q = useQuery({
    queryKey: ['delivery', id],
    enabled: !!id,
    queryFn: () => api<{ delivery: Delivery }>(`/api/deliveries/${id}`),
  })

  const delivery = q.data?.delivery

  useEffect(() => {
    if (!delivery) return
    const next: Record<string, { lotId: string; quantity: string; serialCodesText: string }> = {}
    for (const item of delivery.items) {
      next[item.product.id] = { lotId: '', quantity: String(item.quantity ?? ''), serialCodesText: '' }
    }
    setLotSelections(next)
  }, [delivery?.id])

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
    mutationFn: async (payload?: { lotAllocations?: Array<{ productId: string; lotId: string; quantity: number; serialCodes?: string[] }> }) =>
      api<{ delivery: Delivery }>(`/api/deliveries/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'SHIPPED', shippedAt: new Date().toISOString(), lotAllocations: payload?.lotAllocations ?? [] }),
      }),
    onSuccess: async () => {
      toastUpdated(i, 'delivery')
      await qc.invalidateQueries({ queryKey: ['deliveries'] })
      if (id) await qc.invalidateQueries({ queryKey: ['delivery', id] })
    },
    onError: (e: any) => toastFailedToSave(i, String(e?.message ?? e ?? '')),
  })

  const lotsQ = useQuery({
    queryKey: ['delivery-lots', delivery?.id, delivery?.items.map((item) => item.product.id).join(',')],
    enabled: shipModalOpen && !!delivery,
    queryFn: async () => {
      const entries = await Promise.all(
        (delivery?.items ?? []).map(async (item) => {
          const res = await api<{ lots: InventoryLotOption[] }>(`/api/inventory/${item.product.id}/lots`)
          return [item.product.id, res.lots] as const
        }),
      )
      return Object.fromEntries(entries) as Record<string, InventoryLotOption[]>
    },
  })

  if (q.isLoading) return <p className="text-sm text-[var(--text-muted)]">Carregando...</p>
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
      <header className="rounded-2xl border border-theme bg-[var(--surface-2)] px-5 py-5 shadow-[var(--shadow-sm)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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

          <div className="text-sm text-[var(--text-muted)]">
            PV: <Link className="underline" href={`/app/sales/orders/${delivery.salesOrderId}`}>{delivery.salesOrderId.slice(0, 8)}…</Link>
            {valueNumber != null ? ` • ${formatMoneyDisplay(valueNumber, moneyLocale, currency)}` : ''}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:justify-end">
          <button className="btn btn-secondary" type="button" onClick={() => setShipModalOpen(true)} disabled={shipM.isPending}>
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
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <div className="surface rounded-2xl border border-theme p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Status</div>
          <div className="mt-1 text-2xl font-semibold">{delivery.status}</div>
        </div>
        <div className="surface rounded-2xl border border-theme p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Metodo</div>
          <div className="mt-1 text-2xl font-semibold">{delivery.method}</div>
        </div>
        <div className="surface rounded-2xl border border-theme p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Itens</div>
          <div className="mt-1 text-2xl font-semibold">{delivery.items.length}</div>
        </div>
        <div className="surface rounded-2xl border border-theme p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Valor</div>
          <div className="mt-1 text-2xl font-semibold">{valueNumber == null ? '-' : formatMoneyDisplay(valueNumber, moneyLocale, currency)}</div>
        </div>
      </section>

      <section className="surface rounded-2xl border border-theme p-4 space-y-4">
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

      <section className="surface rounded-2xl border border-theme p-4">
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

      <EntityFieldsSection entity="DELIVERY" entityId={delivery.id} />

      {shipModalOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShipModalOpen(false)} />
          <div className="surface modal-safe absolute left-1/2 top-1/2 w-[min(92vw,42rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-theme p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{language === 'pt' ? 'Expedir com lote manual' : language === 'es' ? 'Expedir con lote manual' : 'Ship with manual lot'}</h2>
                <p className="text-sm text-[var(--text-muted)]">
                  {language === 'pt'
                    ? 'Selecione um lote quando quiser forçar a baixa manual. Sem seleção, o sistema usa FIFO.'
                    : language === 'es'
                      ? 'Selecciona un lote cuando quieras forzar la baja manual. Sin selección, el sistema usa FIFO.'
                      : 'Select a lot when you need to force manual depletion. Without a selection, the system uses FIFO.'}
                </p>
              </div>
              <button className="btn btn-secondary btn-icon" type="button" onClick={() => setShipModalOpen(false)}>
                ×
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              {delivery.items.map((item) => {
                const lots = lotsQ.data?.[item.product.id] ?? []
                const selection = lotSelections[item.product.id] ?? { lotId: '', quantity: String(item.quantity ?? ''), serialCodesText: '' }
                const selectedLot = lots.find((lot) => lot.id === selection.lotId)
                const selectedSerialCount = selection.serialCodesText
                  .split(/\r?\n|,/)
                  .map((entry) => entry.trim())
                  .filter(Boolean).length
                return (
                  <div key={item.id} className="rounded-lg border border-theme p-3">
                    <div className="font-medium">{item.product.name}</div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {String(item.quantity)} {item.product.unit}
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_8rem]">
                      <select
                        value={selection.lotId}
                        onChange={(e) =>
                          setLotSelections((current) => ({
                            ...current,
                            [item.product.id]: { ...selection, lotId: e.target.value },
                          }))
                        }
                        className="w-full rounded-lg border border-theme bg-transparent px-3 py-2 text-sm"
                      >
                        <option value="">{language === 'pt' ? 'FIFO automático' : language === 'es' ? 'FIFO automático' : 'Automatic FIFO'}</option>
                        {lots.map((lot) => (
                          <option key={lot.id} value={lot.id}>
                            {lot.lotCode}
                            {lot.expiresAt ? ` • ${new Date(lot.expiresAt).toLocaleDateString()}` : ''}
                            {` • ${Number(lot.quantity ?? 0)} ${item.product.unit}`}
                          </option>
                        ))}
                      </select>
                      <input
                        value={selection.quantity}
                        onChange={(e) =>
                          setLotSelections((current) => ({
                            ...current,
                            [item.product.id]: { ...selection, quantity: e.target.value },
                          }))
                        }
                        className="w-full rounded-lg border border-theme bg-transparent px-3 py-2 text-sm"
                        inputMode="decimal"
                        placeholder={language === 'pt' ? 'Qtd.' : language === 'es' ? 'Cant.' : 'Qty'}
                      />
                    </div>
                    {selectedLot?.serialCodes?.length ? (
                      <label className="mt-2 grid gap-1">
                        <span className="text-xs text-[var(--text-muted)]">
                          {language === 'pt'
                            ? `Seriais do lote (${selectedLot.serialCodes.length} disponiveis)`
                            : language === 'es'
                              ? `Seriales del lote (${selectedLot.serialCodes.length} disponibles)`
                              : `Lot serials (${selectedLot.serialCodes.length} available)`}
                        </span>
                        <textarea
                          value={selection.serialCodesText}
                          onChange={(e) =>
                            setLotSelections((current) => ({
                              ...current,
                              [item.product.id]: { ...selection, serialCodesText: e.target.value },
                            }))
                          }
                          className="min-h-20 w-full rounded-lg border border-theme bg-transparent px-3 py-2 text-sm"
                          placeholder={
                            language === 'pt'
                              ? 'Informe 1 serial por linha para baixa individual.'
                              : language === 'es'
                                ? 'Informa 1 serial por linea para baja individual.'
                                : 'Enter 1 serial per line for individual depletion.'
                          }
                        />
                        <div className="text-xs text-[var(--text-muted)]">
                          {selectedSerialCount > 0
                            ? language === 'pt'
                              ? `${selectedSerialCount} serial(is) selecionado(s)`
                              : language === 'es'
                                ? `${selectedSerialCount} serial(es) seleccionado(s)`
                                : `${selectedSerialCount} serial(s) selected`
                            : selectedLot.serialCodes.slice(0, 6).join(', ')}
                        </div>
                      </label>
                    ) : null}
                  </div>
                )
              })}
            </div>

            <div className="mt-5 flex gap-2">
              <button className="btn btn-secondary" type="button" onClick={() => setShipModalOpen(false)} disabled={shipM.isPending}>
                {language === 'pt' ? 'Cancelar' : language === 'es' ? 'Cancelar' : 'Cancel'}
              </button>
              <button
                className="btn btn-primary"
                type="button"
                disabled={shipM.isPending}
                onClick={() => {
                  const lotAllocations = delivery.items
                    .map((item) => {
                      const selection = lotSelections[item.product.id]
                      const quantity = Number(String(selection?.quantity ?? '').replace(',', '.'))
                      const serialCodes = (selection?.serialCodesText ?? '')
                        .split(/\r?\n|,/)
                        .map((entry) => entry.trim())
                        .filter(Boolean)
                      if (!selection?.lotId || !Number.isFinite(quantity) || quantity <= 0) return null
                      return { productId: item.product.id, lotId: selection.lotId, quantity, serialCodes }
                    })
                    .filter(Boolean) as Array<{ productId: string; lotId: string; quantity: number; serialCodes?: string[] }>
                  shipM.mutate(
                    { lotAllocations },
                    {
                      onSuccess: () => {
                        setShipModalOpen(false)
                      },
                    },
                  )
                }}
              >
                {language === 'pt' ? 'Confirmar expedição' : language === 'es' ? 'Confirmar expedición' : 'Confirm shipment'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
