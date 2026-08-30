'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/app/app/api-client'
import { toastUpdated, toastFailedToSave } from '@/app/app/toast'
import { useSettings } from '@/app/app/settings-context'
import { t } from '@/app/app/i18n'
import { formatMoneyDisplay, formatMoneyFromNumber, localeFromLanguage, parseMoneyToNumber } from '@/app/app/money'
import { EntityFieldsSection } from '@/app/app/entity-fields-section'

type Receivable = {
  id: string
  salesOrderId: string
  deliveryId: string
  clientId: string | null
  status: 'OPEN' | 'PAID' | 'CANCELLED'
  issuedAt: string
  dueAt: string | null
  value: string | number
  applications: Array<{
    id: string
    value: string | number
    appliedAt: string
    payment: { id: string; method: string; status: string; receivedAt: string | null }
  }>
  createdById: string | null
  updatedById: string | null
  createdAt: string
  updatedAt: string
}

function toLocalDateTimeInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad2 = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function fromLocalDateTimeInput(v: string): string | null {
  const s = (v ?? '').trim()
  if (!s) return null
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

function sumApplied(apps: Receivable['applications']) {
  return apps.reduce((acc, a) => acc + Number(a.value ?? 0), 0)
}

export default function ReceivableDetailsPage() {
  const qc = useQueryClient()
  const params = useParams<{ id: string }>()
  const id = params?.id

  const { language, currency } = useSettings()
  const i = t(language)
  const moneyLocale = localeFromLanguage(language)

  const q = useQuery({
    queryKey: ['receivable', id],
    enabled: !!id,
    queryFn: () => api<{ receivable: Receivable }>(`/api/receivables/${id}`),
  })

  const rec = q.data?.receivable

  const patchM = useMutation({
    mutationFn: (payload: any) =>
      api<{ receivable: Receivable }>(`/api/receivables/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      toastUpdated(i, 'receivable')
      await qc.invalidateQueries({ queryKey: ['receivables'] })
      if (id) await qc.invalidateQueries({ queryKey: ['receivable', id] })
    },
    onError: (e: any) => toastFailedToSave(i, String(e?.message ?? e ?? '')),
  })

  const applyPaymentsM = useMutation({
    mutationFn: () =>
      api<{ receivable: Receivable }>(`/api/receivables/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ applyPayments: true }),
      }),
    onSuccess: async () => {
      toastUpdated(i, 'receivable')
      await qc.invalidateQueries({ queryKey: ['receivables'] })
      if (id) await qc.invalidateQueries({ queryKey: ['receivable', id] })
    },
    onError: (e: any) => toastFailedToSave(i, String(e?.message ?? e ?? '')),
  })

  if (q.isLoading) return <p className="text-sm text-[var(--text-muted)]">Carregando...</p>
  if (q.isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Erro ao carregar: {String(q.error)}
      </div>
    )
  }
  if (!rec) return <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm">NOT_FOUND</div>

  const applied = sumApplied(rec.applications)
  const total = Number(rec.value)
  const open = Math.max(0, total - applied)

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-theme bg-[var(--surface-2)] px-5 py-5 shadow-[var(--shadow-sm)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="text-sm text-[var(--muted-foreground)]">
              <Link href="/app/finance/receivables" className="underline">
                {language === 'pt' ? 'Voltar' : language === 'es' ? 'Volver' : 'Back'}
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">
                {language === 'pt' ? 'Recebivel' : language === 'es' ? 'Por cobrar' : 'Receivable'}
              </h1>
              <span className="badge badge-muted">{rec.id.slice(0, 8)}...</span>
              <span className="badge badge-solid">{rec.status}</span>
            </div>

            <div className="text-sm text-[var(--text-muted)]">
              {formatMoneyDisplay(rec.value, moneyLocale, currency)}
              {applied > 0 ? ` | ${language === 'pt' ? 'Aplicado' : language === 'es' ? 'Aplicado' : 'Applied'}: ${formatMoneyDisplay(applied, moneyLocale, currency)}` : ''}
              {open > 0 ? ` | ${language === 'pt' ? 'Aberto' : language === 'es' ? 'Abierto' : 'Open'}: ${formatMoneyDisplay(open, moneyLocale, currency)}` : ''}
            </div>

            <div className="text-sm text-[var(--text-muted)]">
              PV: <Link className="underline" href={`/app/sales/orders/${rec.salesOrderId}`}>{rec.salesOrderId.slice(0, 8)}...</Link>
              {' | '}
              {language === 'pt' ? 'Entrega' : language === 'es' ? 'Entrega' : 'Delivery'}:{' '}
              <Link className="underline" href={`/app/deliveries/${rec.deliveryId}`}>{rec.deliveryId.slice(0, 8)}...</Link>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 sm:justify-end">
            <button className="btn btn-secondary" type="button" onClick={() => applyPaymentsM.mutate()} disabled={applyPaymentsM.isPending}>
              {language === 'pt' ? 'Aplicar pagamentos' : language === 'es' ? 'Aplicar pagos' : 'Apply payments'}
            </button>
          </div>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="surface rounded-2xl border border-theme p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Valor total</div>
          <div className="mt-1 text-2xl font-semibold">{formatMoneyDisplay(total, moneyLocale, currency)}</div>
        </div>
        <div className="surface rounded-2xl border border-theme p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Aplicado</div>
          <div className="mt-1 text-2xl font-semibold">{formatMoneyDisplay(applied, moneyLocale, currency)}</div>
        </div>
        <div className="surface rounded-2xl border border-theme p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Em aberto</div>
          <div className="mt-1 text-2xl font-semibold">{formatMoneyDisplay(open, moneyLocale, currency)}</div>
        </div>
      </section>

      <section className="surface rounded-2xl border border-theme p-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1">
            <span className="text-xs font-medium text-[var(--foreground)]">{language === 'pt' ? 'Status' : language === 'es' ? 'Estado' : 'Status'}</span>
            <select
              className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
              value={rec.status}
              onChange={(e) => patchM.mutate({ status: e.target.value })}
              disabled={patchM.isPending}
            >
              <option value="OPEN">OPEN</option>
              <option value="PAID">PAID</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-medium text-[var(--foreground)]">{language === 'pt' ? 'Vencimento' : language === 'es' ? 'Vencimiento' : 'Due at'}</span>
            <input
              type="datetime-local"
              className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
              defaultValue={toLocalDateTimeInput(rec.dueAt)}
              onBlur={(e) => patchM.mutate({ dueAt: fromLocalDateTimeInput(e.target.value) })}
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-medium text-[var(--foreground)]">{language === 'pt' ? 'Valor' : language === 'es' ? 'Valor' : 'Value'}</span>
            <input
              className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
              defaultValue={formatMoneyFromNumber(Number(rec.value), moneyLocale)}
              onBlur={(e) => {
                const n = parseMoneyToNumber(e.target.value, moneyLocale)
                if (n == null) return
                patchM.mutate({ value: n })
              }}
              inputMode="decimal"
            />
          </label>
        </div>
      </section>

      <section className="surface rounded-2xl border border-theme p-4">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">{language === 'pt' ? 'Aplicacoes' : language === 'es' ? 'Aplicaciones' : 'Applications'}</h2>
        <div className="mt-3 space-y-2">
          {rec.applications.length ? (
            rec.applications.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-theme px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-[var(--foreground)]">{a.payment.id.slice(0, 8)}...</div>
                  <div className="text-xs text-[var(--muted-foreground)]">
                    {a.payment.method} | {a.payment.status} | {new Date(a.appliedAt).toLocaleString()}
                  </div>
                </div>
                <div className="text-sm tabular-nums text-[var(--muted-foreground)]">{formatMoneyDisplay(a.value, moneyLocale, currency)}</div>
              </div>
            ))
          ) : (
            <div className="text-sm text-[var(--muted-foreground)]">-</div>
          )}
        </div>
      </section>

      <section className="surface rounded-2xl border border-theme p-4">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">{language === 'pt' ? 'Controle' : language === 'es' ? 'Control' : 'Control'}</h2>
        <div className="mt-3 grid gap-2 text-sm text-[var(--muted-foreground)] sm:grid-cols-2">
          <div>
            <span className="font-medium text-[var(--foreground)]">{language === 'pt' ? 'Criado em' : language === 'es' ? 'Creado en' : 'Created at'}:</span>{' '}
            {new Date(rec.createdAt).toLocaleString()}
          </div>
          <div>
            <span className="font-medium text-[var(--foreground)]">{language === 'pt' ? 'Atualizado em' : language === 'es' ? 'Actualizado en' : 'Updated at'}:</span>{' '}
            {new Date(rec.updatedAt).toLocaleString()}
          </div>
          <div>
            <span className="font-medium text-[var(--foreground)]">{language === 'pt' ? 'Criado por' : language === 'es' ? 'Creado por' : 'Created by'}:</span>{' '}
            {rec.createdById ?? '-'}
          </div>
          <div>
            <span className="font-medium text-[var(--foreground)]">{language === 'pt' ? 'Atualizado por' : language === 'es' ? 'Actualizado por' : 'Updated by'}:</span>{' '}
            {rec.updatedById ?? '-'}
          </div>
        </div>
      </section>

      <EntityFieldsSection entity="RECEIVABLE" entityId={rec.id} />
    </div>
  )
}
