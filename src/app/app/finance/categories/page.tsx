'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useSettings } from '../../settings-context'
import DataTable from '../../ui/data-table'

type Category = {
  id: string
  name: string
  type: 'IN' | 'OUT'
  parentId: string | null
  active: boolean
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

export default function FinanceCategoriesPage() {
  const qc = useQueryClient()
  const { language } = useSettings()

  const [type, setType] = useState<'IN' | 'OUT'>('OUT')
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState('')

  const categoriesQ = useQuery({
    queryKey: ['finance', 'categories', type],
    queryFn: () => api<{ categories: Category[] }>(`/api/finance/categories?type=${type}`),
  })

  const createM = useMutation({
    mutationFn: (payload: { name: string; type: 'IN' | 'OUT'; parentId?: string | null }) =>
      api<{ category: Category }>('/api/finance/categories', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['finance', 'categories'] })
    },
  })

  const patchM = useMutation({
    mutationFn: (payload: { id: string; name?: string; active?: boolean; parentId?: string | null }) =>
      api<{ category: Category }>(`/api/finance/categories/${payload.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: payload.name, active: payload.active, parentId: payload.parentId }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['finance', 'categories'] })
    },
  })

  const deleteM = useMutation({
    mutationFn: (id: string) =>
      api<{ ok: true }>(`/api/finance/categories/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['finance', 'categories'] })
    },
  })

  const categories = categoriesQ.data?.categories ?? []
  const rows = useMemo(() => categories, [categories])

  async function save() {
    const n = name.trim()
    if (!n) return
    await createM.mutateAsync({ name: n, type })
    setName('')
    setIsOpen(false)
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <a
            href="/app/finance"
            className="inline-flex items-center gap-2 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            ← {language === 'pt' ? 'Voltar ao Financeiro' : language === 'es' ? 'Volver a Finanzas' : 'Back to Finance'}
          </a>
          <h1 className="mt-2 text-xl font-semibold tracking-tight">
            {language === 'pt' ? 'Categorias' : language === 'es' ? 'Categorías' : 'Categories'}
          </h1>
          <p className="text-sm text-neutral-600">
            {language === 'pt'
              ? 'Categorias para entradas e saídas.'
              : language === 'es'
                ? 'Categorías para ingresos y gastos.'
                : 'Categories for income and expense.'}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            className="rounded-lg border border-theme bg-transparent px-3 py-2 text-sm"
          >
            <option value="OUT">{language === 'pt' ? 'Saídas' : language === 'es' ? 'Gastos' : 'Expense'}</option>
            <option value="IN">{language === 'pt' ? 'Entradas' : language === 'es' ? 'Ingresos' : 'Income'}</option>
          </select>

          <button
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90"
            onClick={() => setIsOpen(true)}
            type="button"
          >
            {language === 'pt' ? 'Nova categoria' : language === 'es' ? 'Nueva' : 'New category'}
          </button>
        </div>
      </header>

      {categoriesQ.isLoading ? (
        <p className="text-sm text-neutral-600">Carregando…</p>
      ) : categoriesQ.isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Erro ao carregar: {String(categoriesQ.error)}
        </div>
      ) : (
        <DataTable
          rows={rows}
          empty={language === 'pt' ? 'Nenhuma categoria.' : language === 'es' ? 'Sin categorías.' : 'No categories.'}
          labels={{
            showing:
              language === 'pt'
                ? 'Mostrando {start}–{end} de {total}'
                : language === 'es'
                  ? 'Mostrando {start}–{end} de {total}'
                  : 'Showing {start}–{end} of {total}',
            page:
              language === 'pt'
                ? 'Página {page} / {pages}'
                : language === 'es'
                  ? 'Página {page} / {pages}'
                  : 'Page {page} / {pages}',
            previous: language === 'pt' ? 'Anterior' : language === 'es' ? 'Anterior' : 'Previous',
            next: language === 'pt' ? 'Próxima' : language === 'es' ? 'Siguiente' : 'Next',
            searchPlaceholder: language === 'pt' ? 'Buscar…' : language === 'es' ? 'Buscar…' : 'Search…',
            clear: language === 'pt' ? 'Limpar' : language === 'es' ? 'Limpiar' : 'Clear',
            noResults:
              language === 'pt'
                ? 'Nenhum registro encontrado para a busca.'
                : language === 'es'
                  ? 'No se encontraron registros.'
                  : 'No results found.',
          }}
          initialSort={{ key: 'name', dir: 'asc' }}
          columns={[
            {
              key: 'name',
              header: language === 'pt' ? 'Nome' : language === 'es' ? 'Nombre' : 'Name',
              sortValue: (r) => r.name,
              searchValue: (r) => r.name,
              render: (r) => <div className="font-medium">{r.name}</div>,
            },
            {
              key: 'active',
              header: language === 'pt' ? 'Ativa' : language === 'es' ? 'Activa' : 'Active',
              sortValue: (r) => (r.active ? 1 : 0),
              searchValue: (r) => (r.active ? 'ativa' : 'inativa'),
              render: (r) => (
                <button
                  type="button"
                  className={
                    'rounded-full border px-2 py-1 text-xs ' +
                    (r.active
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                      : 'border-neutral-300 bg-neutral-50 text-neutral-700')
                  }
                  onClick={(e) => {
                    e.stopPropagation()
                    patchM.mutate({ id: r.id, active: !r.active })
                  }}
                >
                  {r.active
                    ? language === 'pt'
                      ? 'Sim'
                      : language === 'es'
                        ? 'Sí'
                        : 'Yes'
                    : language === 'pt'
                      ? 'Não'
                      : language === 'es'
                        ? 'No'
                        : 'No'}
                </button>
              ),
            },
            {
              key: 'actions',
              header: language === 'pt' ? 'Ações' : language === 'es' ? 'Acciones' : 'Actions',
              render: (r) => (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-theme bg-[var(--surface)] px-3 py-1.5 text-xs hover:bg-[var(--muted)]"
                    onClick={(e) => {
                      e.stopPropagation()
                      const next = prompt(language === 'pt' ? 'Novo nome da categoria:' : 'New category name:', r.name)
                      if (!next) return
                      patchM.mutate({ id: r.id, name: next })
                    }}
                  >
                    {language === 'pt' ? 'Renomear' : language === 'es' ? 'Renombrar' : 'Rename'}
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700 hover:bg-red-100"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (
                        !confirm(
                          language === 'pt'
                            ? 'Desativar esta categoria?'
                            : language === 'es'
                              ? '¿Desactivar esta categoría?'
                              : 'Disable this category?'
                        )
                      )
                        return
                      deleteM.mutate(r.id)
                    }}
                  >
                    {language === 'pt' ? 'Desativar' : language === 'es' ? 'Desactivar' : 'Disable'}
                  </button>
                </div>
              ),
            },
          ]}
        />
      )}

      {isOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsOpen(false)} />
          <div className="surface absolute bottom-0 left-0 right-0 mx-auto w-full max-w-xl rounded-t-2xl border border-theme p-5 shadow-xl sm:bottom-auto sm:top-20 sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">
                  {language === 'pt' ? 'Nova categoria' : language === 'es' ? 'Nueva categoría' : 'New category'}
                </h2>
              </div>
              <button
                aria-label="Fechar"
                className="grid size-9 place-items-center rounded-md text-lg text-[var(--foreground)] hover:bg-[var(--muted)]"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1">
                <span className="text-xs font-medium text-[var(--foreground)]">{language === 'pt' ? 'Nome' : 'Name'}</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
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
                {language === 'pt' ? 'Cancelar' : language === 'es' ? 'Cancelar' : 'Cancel'}
              </button>
              <button
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
                onClick={save}
                type="button"
                disabled={!name.trim() || createM.isPending}
              >
                {language === 'pt' ? 'Salvar' : language === 'es' ? 'Guardar' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
