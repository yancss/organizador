'use client'

import { useState } from 'react'

import { useDraftStorage } from '../use-draft-storage'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { t } from '../i18n'
import { useSettings } from '../settings-context'
import DataTable from '../ui/data-table'
import FieldLabel from '../ui/field-label'
import { toast, toastCreated, toastUpdated, toastDeleted, toastFailedToSave, toastFailedToDelete } from '../toast'
import { api } from '../api-client'

type Product = {
  id: string
  name: string
  brand: string | null
  kind?: 'RAW' | 'INTERMEDIATE' | 'FINISHED'
  unit: string
  avgCost?: string | number | null
  active?: boolean
}

// (moved to api-client.ts)


const UNIT_OPTIONS = ['gr', 'kg', 'ml', 'l', 'un', 'dz']

type Draft = {
  id?: string
  name: string
  brand: string
  kind: 'RAW' | 'INTERMEDIATE' | 'FINISHED'
  unit: string
}

function emptyDraft(): Draft {
  return { name: '', brand: '', kind: 'RAW', unit: 'un' }
}

export default function ProductsPage() {
  const qc = useQueryClient()
  const { language } = useSettings()
  const i = t(language)

  const [isOpen, setIsOpen] = useState(false)
  const draftStore = useDraftStorage<Draft>('draft:products', emptyDraft)
  const draft = draftStore.value
  const setDraft = draftStore.setValue

  const productsQ = useQuery({
    queryKey: ['products'],
    queryFn: () => api<{ products: Product[] }>('/api/products'),
  })

  const createM = useMutation({
    mutationFn: (payload: { name: string; brand: string | null; kind: 'RAW' | 'INTERMEDIATE' | 'FINISHED'; unit: string }) =>
      api<{ product: Product }>('/api/products', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['products'] })
    },
  })

  const updateM = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Product> }) =>
      api<{ product: Product }>(`/api/products/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['products'] })
      await qc.invalidateQueries({ queryKey: ['inventory'] })
    },
  })

  const deleteM = useMutation({
    mutationFn: (id: string) => api<{ ok: true }>(`/api/products/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['products'] })
      await qc.invalidateQueries({ queryKey: ['inventory'] })
    },
  })

  const products = productsQ.data?.products ?? []

  function openCreate() {
    draftStore.clear()
    setIsOpen(true)
  }

  function openEdit(p: Product) {
    setDraft({ id: p.id, name: p.name, brand: p.brand ?? '', kind: p.kind ?? 'RAW', unit: p.unit })
    setIsOpen(true)
  }

  async function save() {
    const name = draft.name.trim()
    if (!name) return

    const payload = {
      name,
      brand: draft.brand.trim() ? draft.brand.trim() : null,
      kind: draft.kind,
      unit: draft.unit,
    }

    try {
      if (draft.id) {
        await updateM.mutateAsync({ id: draft.id, payload })
        toastUpdated(i, 'product')
      } else {
        await createM.mutateAsync(payload)
        toastCreated(i, 'product')
      }

      setIsOpen(false)
      draftStore.clear()
    } catch (e: any) {
      toastFailedToSave(i, String(e?.message ?? ''))
    }
  }

  async function remove() {
    if (!draft.id) return
    if (!confirm(i.products.deleteConfirm)) return

    try {
      await deleteM.mutateAsync(draft.id)
      toastDeleted(i, 'product')
      setIsOpen(false)
      draftStore.clear()
    } catch (e: any) {
      toastFailedToDelete(i, String(e?.message ?? ''))
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{i.products.title}</h1>
          <p className="text-sm text-neutral-600">{i.products.subtitle}</p>
        </div>

        <button
          className="btn btn-primary"
          onClick={openCreate}
          type="button"
        >
          {i.products.new}
        </button>
      </header>

      {productsQ.isLoading ? (
        <p className="text-sm text-neutral-600">Carregando…</p>
      ) : productsQ.isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Erro ao carregar: {String(productsQ.error)}
        </div>
      ) : (
        <DataTable
          rows={products}
          empty={i.products.empty}
          labels={i.table}
          initialSort={{ key: 'name', dir: 'asc' }}
          onRowClick={openEdit}
          columns={[
            {
              key: 'name',
              header: language === 'pt' ? 'Produto' : language === 'es' ? 'Producto' : 'Product',
              sortValue: (r) => r.name,
              searchValue: (r) => r.name,
              render: (r) => <div className="font-medium text-[var(--foreground)]">{r.name}</div>,
            },
            {
              key: 'brand',
              header: language === 'pt' ? 'Marca' : language === 'es' ? 'Marca' : 'Brand',
              sortValue: (r) => r.brand ?? '',
              searchValue: (r) => r.brand ?? '',
              render: (r) => <div className="text-[var(--muted-foreground)]">{r.brand ?? '—'}</div>,
            },
            {
              key: 'unit',
              header: language === 'pt' ? 'Unidade' : language === 'es' ? 'Unidad' : 'Unit',
              sortValue: (r) => r.unit,
              searchValue: (r) => r.unit,
              render: (r) => <div className="text-[var(--muted-foreground)]">{r.unit}</div>,
            },
            {
              key: 'avgCost',
              header: language === 'pt' ? 'Custo méd.' : language === 'es' ? 'Costo prom.' : 'Avg cost',
              sortValue: (r) => Number(r.avgCost ?? 0),
              searchValue: (r) => (r.avgCost == null ? '' : String(r.avgCost)),
              render: (r) => {
                const v = r.avgCost == null ? null : Number(r.avgCost)
                if (!v || !Number.isFinite(v) || v <= 0) return <div className="text-[var(--muted-foreground)]">—</div>
                return <div className="text-[var(--muted-foreground)]">€ {v.toFixed(4)} / {r.unit}</div>
              },
            },
            {
              key: 'kind',
              header: language === 'pt' ? 'Tipo' : language === 'es' ? 'Tipo' : 'Type',
              sortValue: (r) => r.kind ?? '',
              searchValue: (r) => r.kind ?? '',
              render: (r) => (
                <span className="badge badge-solid">
                  {r.kind === 'FINISHED'
                    ? language === 'pt'
                      ? 'Final'
                      : language === 'es'
                        ? 'Final'
                        : 'Finished'
                    : r.kind === 'INTERMEDIATE'
                      ? language === 'pt'
                        ? 'Intermediário'
                        : language === 'es'
                          ? 'Intermedio'
                          : 'Intermediate'
                      : language === 'pt'
                        ? 'Insumo'
                        : language === 'es'
                          ? 'Insumo'
                          : 'Raw'}
                </span>
              ),
            },
          ]}
        />
      )}

      {isOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsOpen(false)} />
          <div className="surface modal-safe absolute bottom-0 left-0 right-0 mx-auto w-full max-w-2xl rounded-t-2xl border border-theme p-5 shadow-xl sm:bottom-auto sm:top-20 sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{draft.id ? i.products.editTitle : i.products.newTitle}</h2>
                <p className="text-sm text-[var(--text-muted)]">{i.products.modalSubtitle}</p>
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
                <FieldLabel required>{i.products.nameLabel}</FieldLabel>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-[var(--foreground)]">{i.products.brandLabel}</span>
                <input
                  value={draft.brand}
                  onChange={(e) => setDraft((d) => ({ ...d, brand: e.target.value }))}
                  placeholder={i.modal.optional}
                  className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                />
              </label>

              <label className="grid gap-1">
                <FieldLabel required>{i.products.kindLabel}</FieldLabel>
                <select
                  value={draft.kind}
                  onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value as any }))}
                  className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                >
                  <option value="RAW">{i.products.kindRaw}</option>
                  <option value="INTERMEDIATE">{language === 'pt' ? 'Intermediário' : language === 'es' ? 'Intermedio' : 'Intermediate'}</option>
                  <option value="FINISHED">{i.products.kindFinished}</option>
                </select>
              </label>

              <label className="grid gap-1">
                <FieldLabel required>{i.products.unitLabel}</FieldLabel>
                <select
                  value={draft.unit}
                  onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))}
                  className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                >
                  {UNIT_OPTIONS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                className="btn btn-danger-soft"
                onClick={remove}
                type="button"
                disabled={!draft.id || deleteM.isPending}
              >
                {i.products.delete}
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
                  disabled={!draft.name.trim() || createM.isPending || updateM.isPending}
                >
                  {i.modal.save}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
