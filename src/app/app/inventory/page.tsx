'use client'

import { useMemo, useState } from 'react'

import { useDraftStorage } from '../use-draft-storage'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { t } from '../i18n'
import { useSettings } from '../settings-context'

type InventoryItem = {
  id: string
  quantity: string | number
  minimum: string | number | null
  updatedAt: string
  product: { id: string; name: string; unit: string }
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) throw new Error(await res.text())
  return (await res.json()) as T
}

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

    await updateM.mutateAsync({ productId: draft.productId, payload })
    setIsOpen(false)
    draftStore.clear()
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
        <section className="surface rounded-xl border border-theme">
          <div className="divide-y">
            {rows.length === 0 ? (
              <div className="p-6 text-sm text-neutral-700">{i.inventory.empty}</div>
            ) : (
              <ul>
                {rows.map((it) => (
                  <li key={it.id} className={`p-4 hover:bg-[var(--muted)] ${it.below ? 'bg-red-50/50' : ''}`}>
                    <button type="button" onClick={() => openEdit(it)} className="w-full text-left">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-neutral-900">{it.product.name}</div>
                          <div className="mt-1 text-sm text-neutral-700">
                            {i.inventory.quantity}: {String(it.quantity)} {it.product.unit}
                            {it.minimum != null ? (
                              <span className="ml-2">• {i.inventory.minimum}: {String(it.minimum)} {it.product.unit}</span>
                            ) : (
                              <span className="ml-2 text-neutral-500">• {i.inventory.noMinimum}</span>
                            )}
                          </div>
                          {it.below ? (
                            <div className="mt-1 text-xs text-red-700">{i.inventory.belowMinimum}</div>
                          ) : null}
                        </div>
                        <div className="text-xs text-neutral-600">{i.inventory.editHint}</div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {isOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsOpen(false)} />
          <div className="surface absolute bottom-0 left-0 right-0 mx-auto w-full max-w-2xl rounded-t-2xl border border-theme p-5 shadow-xl sm:bottom-auto sm:top-20 sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{i.inventory.editTitle}: {draft.productName}</h2>
                <p className="text-sm text-neutral-700">{i.inventory.modalSubtitle}</p>
              </div>
              <button
                aria-label="Fechar"
                className="grid size-9 place-items-center rounded-md text-lg text-neutral-800 hover:bg-neutral-100"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1">
                <span className="text-xs font-medium text-neutral-700">{i.inventory.quantityLabel} ({draft.unit})</span>
                <input
                  value={draft.quantity}
                  onChange={(e) => setDraft((d) => ({ ...d, quantity: e.target.value }))}
                  className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-neutral-700">{i.inventory.minimumLabel} ({draft.unit})</span>
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
                className="rounded-lg border border-theme px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)]"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                {i.modal.cancel}
              </button>
              <button
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
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
