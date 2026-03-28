'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'

import { api } from '@/app/app/api-client'
import { useSettings } from '@/app/app/settings-context'
import { t } from '@/app/app/i18n'
import { formatMoneyDisplay, localeFromLanguage } from '@/app/app/money'
import { AuditHistory } from '@/app/app/audit-history'

type Product = {
  id: string
  name: string
  brand: string | null
  kind: 'RAW' | 'INTERMEDIATE' | 'FINISHED'
  unit: string
  active: boolean
  avgCost: string | number | null
  createdAt: string
  updatedAt: string
  createdById: string | null
  updatedById: string | null
  inventory: { id: string; quantity: string | number; minimum: string | number | null } | null
  barcodes?: Array<{ id: string; code: string; source: string; externalRef: string | null; createdAt: string }>
}

export default function ProductDetailsPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id

  const { language, currency } = useSettings()
  const i = t(language)
  const moneyLocale = localeFromLanguage(language)

  const productQ = useQuery({
    queryKey: ['product', id],
    enabled: !!id,
    queryFn: () => api<{ product: Product }>(`/api/products/${id}`),
  })

  const p = productQ.data?.product

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="text-sm text-[var(--muted-foreground)]">
            <Link className="underline" href="/app/products">
              {language === 'pt' ? 'Voltar' : language === 'es' ? 'Volver' : 'Back'}
            </Link>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">{p?.name ?? (language === 'pt' ? 'Produto' : 'Product')}</h1>
          {p?.brand ? <div className="text-sm text-[var(--muted-foreground)]">{p.brand}</div> : null}
        </div>

        {p?.id ? (
          <Link href={`/app/products?edit=${encodeURIComponent(p.id)}`} className="btn btn-secondary">
            {language === 'pt' ? 'Editar' : language === 'es' ? 'Editar' : 'Edit'}
          </Link>
        ) : null}
      </header>

      {productQ.isLoading ? (
        <p className="text-sm text-[var(--muted-foreground)]">{i.common.loading}</p>
      ) : productQ.isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">Erro ao carregar.</div>
      ) : !p ? (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">NOT_FOUND</div>
      ) : (
        <div className="grid gap-4">
          <section className="surface rounded-xl border border-theme p-4">
            <div className="grid gap-2 text-sm text-[var(--muted-foreground)] sm:grid-cols-2">
              <div>
                <span className="font-medium text-[var(--foreground)]">{language === 'pt' ? 'Tipo' : 'Kind'}:</span> {p.kind}
              </div>
              <div>
                <span className="font-medium text-[var(--foreground)]">{language === 'pt' ? 'Unidade' : 'Unit'}:</span> {p.unit}
              </div>
              <div>
                <span className="font-medium text-[var(--foreground)]">{language === 'pt' ? 'Ativo' : 'Active'}:</span> {p.active ? 'Sim' : 'Não'}
              </div>
              <div>
                <span className="font-medium text-[var(--foreground)]">{language === 'pt' ? 'Custo médio' : 'Avg cost'}:</span>{' '}
                {p.avgCost == null ? '—' : formatMoneyDisplay(p.avgCost, moneyLocale, currency)}
              </div>
            </div>
          </section>

          <section className="surface rounded-xl border border-theme p-4">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">{language === 'pt' ? 'Códigos de barras' : language === 'es' ? 'Códigos de barras' : 'Barcodes'}</h2>
            <div className="mt-2 space-y-2">
              {(p.barcodes ?? []).length ? (
                (p.barcodes ?? []).map((b) => (
                  <div key={b.id} className="flex items-center justify-between gap-3 rounded-lg border border-theme px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-[var(--foreground)]">{b.code}</div>
                      <div className="text-xs text-[var(--muted-foreground)]">{b.source}{b.externalRef ? ` • ${b.externalRef}` : ''}</div>
                    </div>
                    <span className="text-xs text-[var(--muted-foreground)]">{new Date(b.createdAt).toLocaleDateString()}</span>
                  </div>
                ))
              ) : (
                <div className="text-sm text-[var(--muted-foreground)]">—</div>
              )}

              <div className="text-xs text-[var(--muted-foreground)]">
                {language === 'pt'
                  ? 'Para adicionar/remover códigos, use o botão Editar.'
                  : language === 'es'
                    ? 'Para agregar/quitar códigos, usa el botón Editar.'
                    : 'To add/remove codes, use Edit.'}
              </div>
            </div>
          </section>

          <section className="surface rounded-xl border border-theme p-4">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">{language === 'pt' ? 'Estoque' : language === 'es' ? 'Inventario' : 'Inventory'}</h2>
            <div className="mt-2 grid gap-2 text-sm text-[var(--muted-foreground)] sm:grid-cols-2">
              <div>
                <span className="font-medium text-[var(--foreground)]">{language === 'pt' ? 'Quantidade' : 'Quantity'}:</span> {String(p.inventory?.quantity ?? '—')}
              </div>
              <div>
                <span className="font-medium text-[var(--foreground)]">{language === 'pt' ? 'Mínimo' : 'Minimum'}:</span> {p.inventory?.minimum == null ? '—' : String(p.inventory.minimum)}
              </div>
            </div>
          </section>

          <AuditHistory entityType="Product" entityId={p.id} />
        </div>
      )}
    </div>
  )
}
