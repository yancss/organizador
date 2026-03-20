'use client'

import { useMemo, useState } from 'react'

import DataTable from '../ui/data-table'
import { api } from '../api-client'

import { useDraftStorage } from '../use-draft-storage'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { t } from '../i18n'
import { useSettings } from '../settings-context'
import FieldLabel from '../ui/field-label'
import { toast, toastUpdated, toastFailedToSave } from '../toast'

type InventoryItem = {
  id: string
  quantity: string | number
  minimum: string | number | null
  updatedAt: string
  product: { id: string; name: string; unit: string }
}

// (moved to api-client.ts)


type Draft = {
  productId: string
  productName: string
  unit: string
  quantity: string
  minimum: string
}

function emptyDraft(): Draft {
  return { productId: '', productName: '', unit: '', quantity: '', minimum: '' }
}

export default function InventoryPage() {
  const qc = useQueryClient()
  const { language } = useSettings()
  const i = t(language)

  const [isOpen, setIsOpen] = useState(false)
  const draftStore = useDraftStorage<Draft>('draft:inventory', emptyDraft)
  const draft = draftStore.value
  const setDraft = draftStore.setValue

  const invQ = useQuery({
    queryKey: ['inventory'],
    queryFn: () => api<{ items: InventoryItem[] }>('/api/inventory'),
  })

  const updateM = useMutation({
    mutationFn: ({ productId, payload }: { productId: string; payload: any }) =>
      api<{ item: InventoryItem }>(`/api/inventory/${productId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['inventory'] })
    },
  })

  const items = invQ.data?.items ?? []

  const rows = useMemo(() => {
    return items
      .map((it) => {
        const q = Number(it.quantity)
        const m = it.minimum == null ? null : Number(it.minimum)
        const below = m != null && !Number.isNaN(q) && q < m
        return { ...it, q, m, below }
      })
      .sort((a, b) => a.product.name.localeCompare(b.product.name))
  }, [items])

  function openEdit(it: InventoryItem) {
    setDraft({
      productId: it.product.id,
      productName: it.product.name,
      unit: it.product.unit,
      quantity: String(it.quantity ?? ''),
      minimum: it.minimum == null ? '' : String(it.minimum),
    })
    setIsOpen(true)
  }

  async function save() {
    if (!draft.productId) return

    const payload: any = {
      quantity: draft.quantity.trim() ? Number(draft.quantity.replace(',', '.')) : undefined,
      minimum: draft.minimum.trim() ? Number(draft.minimum.replace(',', '.')) : null,
    }

    try {
      await updateM.mutateAsync({ productId: draft.productId, payload })
      toastUpdated(i, 'inventory')
      setIsOpen(false)
      draftStore.clear()
    } catch (e: any) {
      toastFailedToSave(i, String(e?.message ?? ''))
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{i.inventory.title}</h1>
          <p className="text-sm text-neutral-600">{i.inventory.subtitle}</p>
        </div>
      </header>

      {invQ.isLoading ? (
        <p className="text-sm text-neutral-600">Carregando…</p>
      ) : invQ.isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Erro ao carregar: {String(invQ.error)}
        </div>
      ) : (
        <DataTable
          rows={rows}
          empty={i.inventory.empty}
          labels={i.table}
          initialSort={{ key: 'product', dir: 'asc' }}
          onRowClick={openEdit}
          columns={[
            {
              key: 'product',
              header: language === 'pt' ? 'Produto' : language === 'es' ? 'Producto' : 'Product',
              sortValue: (r) => r.product.name,
              searchValue: (r) => r.product.name,
              render: (r) => (
                <div className="font-medium text-[var(--foreground)]">
                  {r.product.name}
                  {r.below ? (
                    <span className="ml-2 badge badge-danger">
                      {language === 'pt' ? 'Abaixo do mín.' : language === 'es' ? 'Bajo mínimo' : 'Below min'}
                    </span>
                  ) : null}
                </div>
              ),
            },
            {
              key: 'qty',
              header: language === 'pt' ? 'Qtd.' : language === 'es' ? 'Cant.' : 'Qty',
              sortValue: (r) => r.q,
              searchValue: (r) => String(r.quantity),
              render: (r) => (
                <div className="text-[var(--muted-foreground)]">
                  {String(r.quantity)} {r.product.unit}
                </div>
              ),
            },
            {
              key: 'min',
              header: language === 'pt' ? 'Mín.' : language === 'es' ? 'Mín.' : 'Min',
              sortValue: (r) => (r.minimum == null ? -1 : r.m ?? -1),
              searchValue: (r) => (r.minimum == null ? '' : String(r.minimum)),
              render: (r) => (
                <div className="text-[var(--muted-foreground)]">
                  {r.minimum == null ? '—' : `${String(r.minimum)} ${r.product.unit}`}
                </div>
              ),
            },
            {
              key: 'updated',
              header: language === 'pt' ? 'Atualizado' : language === 'es' ? 'Actualizado' : 'Updated',
              sortValue: (r) => new Date(r.updatedAt),
              render: (r) => (
                <div className="text-[var(--muted-foreground)]">
                  {new Date(r.updatedAt).toLocaleString()}
                </div>
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
                <h2 className="text-lg font-semibold">{i.inventory.editTitle}: {draft.productName}</h2>
                <p className="text-sm text-[var(--text-muted)]">{i.inventory.modalSubtitle}</p>
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
                <FieldLabel>{i.inventory.quantityLabel} ({draft.unit})</FieldLabel>
                <input
                  value={draft.quantity}
                  onChange={(e) => setDraft((d) => ({ ...d, quantity: e.target.value }))}
                  className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-[var(--foreground)]">{i.inventory.minimumLabel} ({draft.unit})</span>
                <input
                  value={draft.minimum}
                  onChange={(e) => setDraft((d) => ({ ...d, minimum: e.target.value }))}
                  placeholder={i.modal.optional}
                  className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
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
                disabled={updateM.isPending}
              >
                {i.modal.save}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
