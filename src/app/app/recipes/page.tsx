'use client'

import { useEffect, useState } from 'react'

import { useDraftStorage } from '../use-draft-storage'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { t } from '../i18n'
import { useSettings } from '../settings-context'
import DataTable from '../ui/data-table'
import SearchSelect from '../ui/search-select'
import FieldLabel from '../ui/field-label'
import { toast, toastCreated, toastUpdated, toastDeleted, toastFailedToSave, toastFailedToDelete } from '../toast'
import { api } from '../api-client'
import { convertQty, formatConvertedPreview, isConvertible, normalizeUnit } from '@/lib/unit-conversion'

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

// (moved to api-client.ts)


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
  const [addQtyUnit, setAddQtyUnit] = useState('')

  const [editUnits, setEditUnits] = useState<Record<string, string>>({})

  // We keep these queries for display purposes in lists, but selection in the modal is search-based.
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

  function openCreate() {
    setDraft({ productId: '', yieldQty: '', observations: '' })
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
    const first = raws[0]?.id ?? ''
    setAddRawProductId(first)
    const unit = first ? (raws.find((p) => p.id === first)?.unit ?? '') : ''
    setAddQtyUnit(unit)
    setAddQty('')

    setEditUnits({})
  }

  async function saveRecipe() {
    const payload = {
      productId: draft.productId,
      yieldQty: draft.yieldQty.trim() ? Number(draft.yieldQty.replace(',', '.')) : null,
      observations: draft.observations.trim() ? draft.observations.trim() : null,
    }

    try {
      if (draft.id) {
        await updateRecipeM.mutateAsync({ id: draft.id, payload })
        toastUpdated(i, 'recipe')
      } else {
        const res = await createRecipeM.mutateAsync(payload)
        toastCreated(i, 'recipe')
        // open newly created
        setDraft((d) => ({ ...d, id: res.recipe.id }))
        setSelectedRecipeId(res.recipe.id)

        const firstRaw = rawProductsQ.data?.products?.[0]?.id
        if (firstRaw) setAddRawProductId(firstRaw)
      }
    } catch (e: any) {
      toastFailedToSave(i, String(e?.message ?? ''))
    }
  }

  async function removeRecipe() {
    if (!draft.id) return
    if (!confirm(i.recipes.deleteConfirm)) return

    try {
      await deleteRecipeM.mutateAsync(draft.id)
      toastDeleted(i, 'recipe')
      setIsOpen(false)
      draftStore.clear()
      setSelectedRecipeId(null)
    } catch (e: any) {
      toastFailedToDelete(i, String(e?.message ?? ''))
    }
  }

  // Ensure the RAW product selector is always initialized when editing/creating a recipe.
  useEffect(() => {
    if (!isOpen) return
    if (!draft.id) return
    if (addRawProductId) return

    const firstRaw = rawProductsQ.data?.products?.[0]?.id ?? ''
    if (firstRaw) {
      setAddRawProductId(firstRaw)
      const unit = rawProductsQ.data?.products?.find((p) => p.id === firstRaw)?.unit ?? ''
      setAddQtyUnit(unit)
    }
  }, [addRawProductId, draft.id, isOpen, rawProductsQ.data?.products])

  async function addItem() {
    if (!draft.id) return
    const q = Number(addQty.replace(',', '.'))
    if (!addRawProductId || !Number.isFinite(q) || q <= 0) return

    const raw = (rawProductsQ.data?.products ?? []).find((p) => p.id === addRawProductId)
    const productUnit = raw?.unit ?? ''
    const fromUnit = addQtyUnit || productUnit

    if (!productUnit || !fromUnit) return
    if (!isConvertible(fromUnit, productUnit)) return

    const qConverted = convertQty(q, fromUnit, productUnit)

    await addItemM.mutateAsync({ recipeId: draft.id, productId: addRawProductId, quantity: qConverted })
    setAddQty('')
  }

  const selected = recipeDetailQ.data?.recipe

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{i.recipes.title}</h1>
        </div>

        <button
          className="btn btn-primary"
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
        <DataTable
          rows={recipes}
          empty={i.recipes.empty}
          labels={i.table}
          initialSort={{ key: 'product', dir: 'asc' }}
          onRowClick={openEdit}
          columns={[
            {
              key: 'product',
              header: language === 'pt' ? 'Produto final' : language === 'es' ? 'Producto final' : 'Final product',
              sortValue: (r) => r.product.name,
              searchValue: (r) => r.product.name,
              render: (r) => <div className="font-medium text-[var(--foreground)]">{r.product.name}</div>,
            },
            {
              key: 'items',
              header: language === 'pt' ? 'Itens' : language === 'es' ? 'Ítems' : 'Items',
              sortValue: (r) => r._count?.items ?? 0,
              searchValue: (r) => String(r._count?.items ?? 0),
              render: (r) => <div className="text-[var(--muted-foreground)]">{r._count?.items ?? 0}</div>,
            },
            {
              key: 'yield',
              header: language === 'pt' ? 'Rendimento' : language === 'es' ? 'Rendimiento' : 'Yield',
              sortValue: (r) => (r.yieldQty == null ? -1 : Number(r.yieldQty)),
              searchValue: (r) => (r.yieldQty == null ? '' : String(r.yieldQty)),
              render: (r) => (
                <div className="text-[var(--muted-foreground)]">
                  {r.yieldQty == null ? '—' : `${String(r.yieldQty)} ${r.product.unit}`}
                </div>
              ),
            },
            {
              key: 'obs',
              header: language === 'pt' ? 'Obs.' : language === 'es' ? 'Notas' : 'Notes',
              sortValue: (r) => r.observations ?? '',
              searchValue: (r) => r.observations ?? '',
              render: (r) => (
                <div className="max-w-[36ch] truncate text-[var(--muted-foreground)]">{r.observations ?? '—'}</div>
              ),
            },
          ]}
        />
      )}

      {isOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsOpen(false)} />
          <div className="surface modal-safe absolute bottom-0 left-0 right-0 mx-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-theme p-5 shadow-xl sm:bottom-auto sm:top-16 sm:max-h-[calc(100dvh-8rem)] sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{draft.id ? i.recipes.editTitle : i.recipes.newTitle}</h2>
                <p className="text-sm text-[var(--text-muted)]">{i.recipes.modalSubtitle}</p>
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

            <div className="mt-4 flex-1 overflow-y-auto">
              <div className="grid gap-3">
              <label className="grid gap-1">
                <FieldLabel required>{i.recipes.finalProduct}</FieldLabel>

                <SearchSelect
                  value={
                    draft.productId
                      ? (() => {
                          const found = (finalProductsQ.data?.products ?? []).find((p) => p.id === draft.productId)
                          return found ? { id: found.id, label: `${found.name} (${found.unit})` } : { id: draft.productId, label: '—' }
                        })()
                      : null
                  }
                  onChange={(next) => setDraft((d) => ({ ...d, productId: next?.id ?? '' }))}
                  minChars={2}
                  labels={{
                    placeholder: language === 'pt' ? 'Selecione…' : language === 'es' ? 'Seleccione…' : 'Select…',
                    hint: language === 'pt' ? 'Digite pelo menos 2 letras…' : language === 'es' ? 'Escribe 2+ letras…' : 'Type at least 2 letters…',
                    loading: language === 'pt' ? 'Buscando…' : language === 'es' ? 'Buscando…' : 'Searching…',
                    empty: language === 'pt' ? 'Nenhum produto encontrado.' : language === 'es' ? 'No se encontraron productos.' : 'No products found.',
                    clear: language === 'pt' ? 'Limpar seleção' : language === 'es' ? 'Limpiar selección' : 'Clear selection',
                  }}
                  fetcher={async (q) => {
                    const res = await fetch(`/api/products?kind=FINISHED&q=${encodeURIComponent(q)}`)
                    if (!res.ok) throw new Error(await res.text())
                    const data = (await res.json()) as { products: Array<{ id: string; name: string; unit: string }> }
                    return (data.products ?? []).map((p) => ({ id: p.id, label: `${p.name} (${p.unit})` }))
                  }}
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-[var(--foreground)]">{i.recipes.yield}</span>
                <input
                  value={draft.yieldQty}
                  onChange={(e) => setDraft((d) => ({ ...d, yieldQty: e.target.value }))}
                  placeholder={i.modal.optional}
                  className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-[var(--foreground)]">{i.recipes.observations}</span>
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

                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px_140px_120px] sm:items-center">
                    <SearchSelect
                      value={
                        addRawProductId
                          ? (() => {
                              const found = (rawProductsQ.data?.products ?? []).find((p) => p.id === addRawProductId)
                              return found ? { id: found.id, label: `${found.name} (${found.unit})` } : { id: addRawProductId, label: '—' }
                            })()
                          : null
                      }
                      onChange={(next) => {
                        const id = next?.id ?? ''
                        setAddRawProductId(id)
                        const unit = id ? (rawProductsQ.data?.products ?? []).find((p) => p.id === id)?.unit ?? '' : ''
                        setAddQtyUnit(unit)
                      }}
                      minChars={2}
                      labels={{
                        placeholder: language === 'pt' ? 'Selecione…' : language === 'es' ? 'Seleccione…' : 'Select…',
                        hint: language === 'pt' ? 'Digite pelo menos 2 letras…' : language === 'es' ? 'Escribe 2+ letras…' : 'Type at least 2 letters…',
                        loading: language === 'pt' ? 'Buscando…' : language === 'es' ? 'Buscando…' : 'Searching…',
                        empty: language === 'pt' ? 'Nenhum produto encontrado.' : language === 'es' ? 'No se encontraron productos.' : 'No products found.',
                        clear: language === 'pt' ? 'Limpar seleção' : language === 'es' ? 'Limpiar selección' : 'Clear selection',
                      }}
                      fetcher={async (q) => {
                        const res = await fetch(`/api/products?kind=RAW&q=${encodeURIComponent(q)}`)
                        if (!res.ok) throw new Error(await res.text())
                        const data = (await res.json()) as { products: Array<{ id: string; name: string; unit: string }> }
                        return (data.products ?? []).map((p) => ({ id: p.id, label: `${p.name} (${p.unit})` }))
                      }}
                    />

                    <select
                      value={addQtyUnit}
                      onChange={(e) => setAddQtyUnit(e.target.value)}
                      className="w-full rounded-lg border border-theme bg-transparent px-3 py-2 text-sm"
                    >
                      {(() => {
                        const raw = (rawProductsQ.data?.products ?? []).find((p) => p.id === addRawProductId)
                        const base = raw?.unit ?? ''
                        const n = normalizeUnit(base)
                        const options: string[] = []
                        if (!n) return options
                        if (n === 'kg' || n === 'gr' || n === 'g') options.push('kg', 'gr')
                        if (n === 'l' || n === 'ml') options.push('l', 'ml')
                        if (n === 'un' || n === 'dz') options.push('un', 'dz')
                        return options
                      })().map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>

                    <div className="grid gap-1">
                      <input
                        value={addQty}
                        onChange={(e) => setAddQty(e.target.value)}
                        placeholder={i.recipes.qtyPlaceholder}
                        className="w-full rounded-lg border border-theme bg-transparent px-3 py-2 text-sm"
                      />
                      {(() => {
                        const raw = (rawProductsQ.data?.products ?? []).find((p) => p.id === addRawProductId)
                        const base = raw?.unit ?? ''
                        if (!addQty.trim() || !base || !addQtyUnit) return null
                        if (normalizeUnit(addQtyUnit) === normalizeUnit(base)) return null
                        const res = formatConvertedPreview({ qtyRaw: addQty, fromUnit: addQtyUnit, toUnit: base, digits: 4 })
                        if (!res.ok) return null
                        return <div className="text-[10px] text-[var(--muted-foreground)]">{res.text}</div>
                      })()}
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary"
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
                      {selected.items.map((it) => {
                        const unitKey = it.id
                        const baseUnit = it.product.unit
                        const currentUnit = editUnits[unitKey] ?? baseUnit

                        return (
                          <div key={it.id} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px_160px_120px] sm:items-center">
                            <div className="text-sm">
                              {it.product.name} <span className="text-neutral-500">({it.product.unit})</span>
                            </div>

                            <select
                              value={currentUnit}
                              onChange={(e) => setEditUnits((m) => ({ ...m, [unitKey]: e.target.value }))}
                              className="w-full rounded-lg border border-theme bg-transparent px-3 py-2 text-sm"
                            >
                              {(() => {
                                const n = normalizeUnit(baseUnit)
                                const options: string[] = []
                                if (!n) return options
                                if (n === 'kg' || n === 'gr' || n === 'g') options.push('kg', 'gr')
                                if (n === 'l' || n === 'ml') options.push('l', 'ml')
                                if (n === 'un' || n === 'dz') options.push('un', 'dz')
                                return options
                              })().map((u) => (
                                <option key={u} value={u}>
                                  {u}
                                </option>
                              ))}
                            </select>

                            <div className="grid gap-1">
                              <input
                                defaultValue={String(it.quantity)}
                                className="w-full rounded-lg border border-theme bg-transparent px-3 py-2 text-sm"
                                onBlur={(e) => {
                                  const q = Number(e.target.value.replace(',', '.'))
                                  if (!Number.isFinite(q) || q <= 0) return
                                  if (!isConvertible(currentUnit, baseUnit)) return
                                  const q2 = convertQty(q, currentUnit, baseUnit)
                                  updateItemM.mutate({ recipeId: draft.id!, itemId: it.id, quantity: q2 })
                                }}
                              />

                            </div>

                            <button
                              type="button"
                              className="btn btn-danger-soft"
                              onClick={() => {
                                if (!confirm(i.recipes.deleteItemConfirm)) return
                                deleteItemM.mutate({ recipeId: draft.id!, itemId: it.id })
                              }}
                            >
                              {i.recipes.removeItem}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-neutral-600">{i.recipes.noItems}</p>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-theme bg-[var(--surface-2)] p-3 text-sm text-[var(--text-muted)]">
                  {i.recipes.saveToAddItems}
                </div>
              )}
              </div>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                className="btn btn-danger-soft"
                onClick={removeRecipe}
                type="button"
                disabled={!draft.id || deleteRecipeM.isPending}
              >
                {i.recipes.delete}
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
