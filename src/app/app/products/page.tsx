'use client'

import { useMemo, useState } from 'react'

import { useDraftStorage } from '../use-draft-storage'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { t } from '../i18n'
import { useSettings } from '../settings-context'

type Product = {
  id: string
  name: string
  brand: string | null
  kind?: 'RAW' | 'FINISHED'
  unit: string
  active?: boolean
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

const UNIT_OPTIONS = ['gr', 'kg', 'ml', 'un','dz']

type Draft = {
  id?: string
  name: string
  brand: string
  kind: 'RAW' | 'FINISHED'
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
    mutationFn: (payload: { name: string; brand: string | null; kind: 'RAW' | 'FINISHED'; unit: string }) =>
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

  const sorted = useMemo(() => {
    const items = [...products]
    items.sort((a, b) => a.name.localeCompare(b.name))
    return items
  }, [products])

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

    if (draft.id) {
      await updateM.mutateAsync({ id: draft.id, payload })
    } else {
      await createM.mutateAsync(payload)
    }

    setIsOpen(false)
    draftStore.clear()
  }

  async function remove() {
    if (!draft.id) return
    if (!confirm(i.products.deleteConfirm)) return
    await deleteM.mutateAsync(draft.id)
    setIsOpen(false)
    draftStore.clear()
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{i.products.title}</h1>
          <p className="text-sm text-neutral-600">{i.products.subtitle}</p>
        </div>

        <button
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90"
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
        <section className="surface rounded-xl border border-theme">
          <div className="divide-y">
            {sorted.length === 0 ? (
              <div className="p-6 text-sm text-neutral-700">{i.products.empty}</div>
            ) : (
              <ul>
                {sorted.map((p) => (
                  <li key={p.id} className="p-4 hover:bg-[var(--muted)]">
                    <button type="button" onClick={() => openEdit(p)} className="w-full text-left">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-neutral-900">{p.name}</div>
                          <div className="mt-1 text-sm text-neutral-700">
                            {p.brand ? `${p.brand} • ` : ''}{i.products.unit}: {p.unit}
                          </div>
                        </div>
                        <div className="text-xs text-neutral-600">{i.products.editHint}</div>
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
                <h2 className="text-lg font-semibold">{draft.id ? i.products.editTitle : i.products.newTitle}</h2>
                <p className="text-sm text-neutral-700">{i.products.modalSubtitle}</p>
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
                <span className="text-xs font-medium text-neutral-700">{i.products.nameLabel}</span>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-neutral-700">{i.products.brandLabel}</span>
                <input
                  value={draft.brand}
                  onChange={(e) => setDraft((d) => ({ ...d, brand: e.target.value }))}
                  placeholder={i.modal.optional}
                  className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-neutral-700">{i.products.kindLabel}</span>
                <select
                  value={draft.kind}
                  onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value as any }))}
                  className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                >
                  <option value="RAW">{i.products.kindRaw}</option>
                  <option value="FINISHED">{i.products.kindFinished}</option>
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-neutral-700">{i.products.unitLabel}</span>
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
                className="rounded-lg border border-theme px-4 py-2 text-sm text-[var(--danger)] hover:bg-[var(--danger-bg)] disabled:opacity-50"
                onClick={remove}
                type="button"
                disabled={!draft.id || deleteM.isPending}
              >
                {i.products.delete}
              </button>

              <div className="flex gap-2">
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
