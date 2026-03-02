'use client'

import { useEffect, useMemo, useState } from 'react'

import { useDraftStorage } from '../use-draft-storage'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { t } from '../i18n'
import { useSettings } from '../settings-context'

type Product = { id: string; name: string; unit: string; kind: 'RAW' | 'FINISHED' }

type RecipeItem = {
  id: string
  quantity: string | number
  product: Product
}

type Recipe = {
  id: string
  observations: string | null
  yieldQty: string | number | null
  product: Product
  items?: RecipeItem[]
  _count?: { items: number }
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
  id?: string
  productId: string
  yieldQty: string
  observations: string
}

function emptyDraft(): Draft {
  return { productId: '', yieldQty: '', observations: '' }
}

export default function RecipesPage() {
  const qc = useQueryClient()
  const { language } = useSettings()
  const i = t(language)

  const [isOpen, setIsOpen] = useState(false)
  const draftStore = useDraftStorage<Draft>('draft:recipes', emptyDraft)
  const draft = draftStore.value
  const setDraft = draftStore.setValue

  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null)
  const [addRawProductId, setAddRawProductId] = useState('')
  const [addQty, setAddQty] = useState('')

  const finalProductsQ = useQuery({
    queryKey: ['products', 'FINISHED'],
    queryFn: () => api<{ products: Product[] }>('/api/products?kind=FINISHED'),
  })

  const rawProductsQ = useQuery({
    queryKey: ['products', 'RAW'],
    queryFn: () => api<{ products: Product[] }>('/api/products?kind=RAW'),
  })

  const recipesQ = useQuery({
    queryKey: ['recipes'],
    queryFn: () => api<{ recipes: Recipe[] }>('/api/recipes'),
  })

  const recipeDetailQ = useQuery({
    queryKey: ['recipe', selectedRecipeId],
    enabled: !!selectedRecipeId,
    queryFn: () => api<{ recipe: Recipe }>(`/api/recipes/${selectedRecipeId}`),
  })

  const createRecipeM = useMutation({
    mutationFn: (payload: { productId: string; yieldQty: number | null; observations: string | null }) =>
      api<{ recipe: Recipe }>('/api/recipes', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['recipes'] })
    },
  })

  const updateRecipeM = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      api<{ recipe: Recipe }>(`/api/recipes/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['recipes'] })
      await qc.invalidateQueries({ queryKey: ['recipe'] })
    },
  })

  const deleteRecipeM = useMutation({
    mutationFn: (id: string) => api<{ ok: true }>(`/api/recipes/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['recipes'] })
      await qc.invalidateQueries({ queryKey: ['recipe'] })
    },
  })

  const addItemM = useMutation({
    mutationFn: ({ recipeId, productId, quantity }: { recipeId: string; productId: string; quantity: number }) =>
      api<{ item: RecipeItem }>(`/api/recipes/${recipeId}/items`, {
        method: 'POST',
        body: JSON.stringify({ productId, quantity }),
      }),
    onSuccess: async (_data, vars) => {
      await qc.invalidateQueries({ queryKey: ['recipe', vars.recipeId] })
      await qc.invalidateQueries({ queryKey: ['recipes'] })
    },
  })

  const updateItemM = useMutation({
    mutationFn: ({ recipeId, itemId, quantity }: { recipeId: string; itemId: string; quantity: number }) =>
      api<{ item: RecipeItem }>(`/api/recipes/${recipeId}/items/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify({ quantity }),
      }),
    onSuccess: async (_data, vars) => {
      await qc.invalidateQueries({ queryKey: ['recipe', vars.recipeId] })
      await qc.invalidateQueries({ queryKey: ['recipes'] })
    },
  })

  const deleteItemM = useMutation({
    mutationFn: ({ recipeId, itemId }: { recipeId: string; itemId: string }) =>
      api<{ ok: true }>(`/api/recipes/${recipeId}/items/${itemId}`, { method: 'DELETE' }),
    onSuccess: async (_data, vars) => {
      await qc.invalidateQueries({ queryKey: ['recipe', vars.recipeId] })
      await qc.invalidateQueries({ queryKey: ['recipes'] })
    },
  })

  const recipes = recipesQ.data?.recipes ?? []

  const sorted = useMemo(() => {
    const items = [...recipes]
    items.sort((a, b) => a.product.name.localeCompare(b.product.name))
    return items
  }, [recipes])

  function openCreate() {
    const first = finalProductsQ.data?.products?.[0]?.id ?? ''
    setDraft({ productId: first, yieldQty: '', observations: '' })
    setSelectedRecipeId(null)
    setIsOpen(true)
  }

  function openEdit(r: Recipe) {
    setDraft({
      id: r.id,
      productId: r.product.id,
      yieldQty: r.yieldQty == null ? '' : String(r.yieldQty),
      observations: r.observations ?? '',
    })
    setSelectedRecipeId(r.id)
    setIsOpen(true)

    // If RAW products are not loaded yet, we'll fill this via effect below.
    const raws = rawProductsQ.data?.products ?? []
    setAddRawProductId(raws[0]?.id ?? '')
    setAddQty('')
  }

  async function saveRecipe() {
    const payload = {
      productId: draft.productId,
      yieldQty: draft.yieldQty.trim() ? Number(draft.yieldQty.replace(',', '.')) : null,
      observations: draft.observations.trim() ? draft.observations.trim() : null,
    }

    if (draft.id) {
      await updateRecipeM.mutateAsync({ id: draft.id, payload })
    } else {
      const res = await createRecipeM.mutateAsync(payload)
      // open newly created
      setDraft((d) => ({ ...d, id: res.recipe.id }))
      setSelectedRecipeId(res.recipe.id)

      const firstRaw = rawProductsQ.data?.products?.[0]?.id
      if (firstRaw) setAddRawProductId(firstRaw)
    }
  }

  async function removeRecipe() {
    if (!draft.id) return
    if (!confirm(i.recipes.deleteConfirm)) return
    await deleteRecipeM.mutateAsync(draft.id)
    setIsOpen(false)
    draftStore.clear()
    setSelectedRecipeId(null)
  }

  // Ensure the RAW product selector is always initialized when editing/creating a recipe.
  useEffect(() => {
    if (!isOpen) return
    if (!draft.id) return
    if (addRawProductId) return

    const firstRaw = rawProductsQ.data?.products?.[0]?.id ?? ''
    if (firstRaw) setAddRawProductId(firstRaw)
  }, [addRawProductId, draft.id, isOpen, rawProductsQ.data?.products])

  async function addItem() {
    if (!draft.id) return
    const q = Number(addQty.replace(',', '.'))
    if (!addRawProductId || !Number.isFinite(q) || q <= 0) return

    await addItemM.mutateAsync({ recipeId: draft.id, productId: addRawProductId, quantity: q })
    setAddQty('')
  }

  const selected = recipeDetailQ.data?.recipe

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{i.recipes.title}</h1>
          <p className="text-sm text-neutral-600">{i.recipes.subtitle}</p>
        </div>

        <button
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90"
          onClick={openCreate}
          type="button"
        >
          {i.recipes.new}
        </button>
      </header>

      {recipesQ.isLoading ? (
        <p className="text-sm text-neutral-600">Carregando…</p>
      ) : recipesQ.isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Erro ao carregar: {String(recipesQ.error)}
        </div>
      ) : (
        <section className="surface rounded-xl border border-theme">
          <div className="divide-y">
            {sorted.length === 0 ? (
              <div className="p-6 text-sm text-neutral-700">{i.recipes.empty}</div>
            ) : (
              <ul>
                {sorted.map((r) => (
                  <li key={r.id} className="p-4 hover:bg-[var(--muted)]">
                    <button type="button" onClick={() => openEdit(r)} className="w-full text-left">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-neutral-900">{r.product.name}</div>
                          <div className="mt-1 text-sm text-neutral-700">
                            {i.recipes.itemsCount}: {r._count?.items ?? 0}
                            {r.yieldQty != null ? ` • ${i.recipes.yield}: ${String(r.yieldQty)} ${r.product.unit}` : ''}
                          </div>
                        </div>
                        <div className="text-xs text-neutral-600">{i.recipes.editHint}</div>
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
          <div className="surface absolute bottom-0 left-0 right-0 mx-auto w-full max-w-3xl rounded-t-2xl border border-theme p-5 shadow-xl sm:bottom-auto sm:top-16 sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{draft.id ? i.recipes.editTitle : i.recipes.newTitle}</h2>
                <p className="text-sm text-neutral-700">{i.recipes.modalSubtitle}</p>
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
                <span className="text-xs font-medium text-neutral-700">{i.recipes.finalProduct}</span>
                <select
                  value={draft.productId}
                  onChange={(e) => setDraft((d) => ({ ...d, productId: e.target.value }))}
                  className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                >
                  {(finalProductsQ.data?.products ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.unit})
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-neutral-700">{i.recipes.yield}</span>
                <input
                  value={draft.yieldQty}
                  onChange={(e) => setDraft((d) => ({ ...d, yieldQty: e.target.value }))}
                  placeholder={i.modal.optional}
                  className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-neutral-700">{i.recipes.observations}</span>
                <textarea
                  value={draft.observations}
                  onChange={(e) => setDraft((d) => ({ ...d, observations: e.target.value }))}
                  placeholder={i.modal.optional}
                  className="min-h-20 w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                />
              </label>

              {draft.id ? (
                <div className="rounded-lg border border-theme p-3">
                  <div className="text-sm font-medium">{i.recipes.itemsTitle}</div>

                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px_120px] sm:items-center">
                    <select
                      value={addRawProductId}
                      onChange={(e) => setAddRawProductId(e.target.value)}
                      className="w-full rounded-lg border border-theme bg-transparent px-3 py-2 text-sm"
                    >
                      {(rawProductsQ.data?.products ?? []).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.unit})
                        </option>
                      ))}
                    </select>
                    <input
                      value={addQty}
                      onChange={(e) => setAddQty(e.target.value)}
                      placeholder={i.recipes.qtyPlaceholder}
                      className="w-full rounded-lg border border-theme bg-transparent px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
                      onClick={addItem}
                      disabled={addItemM.isPending}
                    >
                      {i.recipes.addItem}
                    </button>
                  </div>

                  {recipeDetailQ.isLoading ? (
                    <p className="mt-3 text-sm text-neutral-600">Carregando itens…</p>
                  ) : selected?.items?.length ? (
                    <div className="mt-3 grid gap-2">
                      {selected.items.map((it) => (
                        <div key={it.id} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_160px_120px] sm:items-center">
                          <div className="text-sm">
                            {it.product.name} <span className="text-neutral-500">({it.product.unit})</span>
                          </div>
                          <input
                            defaultValue={String(it.quantity)}
                            className="w-full rounded-lg border border-theme bg-transparent px-3 py-2 text-sm"
                            onBlur={(e) => {
                              const q = Number(e.target.value.replace(',', '.'))
                              if (!Number.isFinite(q) || q <= 0) return
                              updateItemM.mutate({ recipeId: draft.id!, itemId: it.id, quantity: q })
                            }}
                          />
                          <button
                            type="button"
                            className="rounded-lg border border-theme px-3 py-2 text-sm text-[var(--danger)] hover:bg-[var(--danger-bg)]"
                            onClick={() => {
                              if (!confirm(i.recipes.deleteItemConfirm)) return
                              deleteItemM.mutate({ recipeId: draft.id!, itemId: it.id })
                            }}
                          >
                            {i.recipes.removeItem}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-neutral-600">{i.recipes.noItems}</p>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-theme bg-[var(--surface-2)] p-3 text-sm text-neutral-700">
                  {i.recipes.saveToAddItems}
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                className="rounded-lg border border-theme px-4 py-2 text-sm text-[var(--danger)] hover:bg-[var(--danger-bg)] disabled:opacity-50"
                onClick={removeRecipe}
                type="button"
                disabled={!draft.id || deleteRecipeM.isPending}
              >
                {i.recipes.delete}
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
                  onClick={saveRecipe}
                  type="button"
                  disabled={!draft.productId || createRecipeM.isPending || updateRecipeM.isPending}
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
