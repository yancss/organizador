'use client'

import { useState } from 'react'

import { useDraftStorage } from '../use-draft-storage'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { t } from '../i18n'
import { useSettings } from '../settings-context'
import DataTable from '../ui/data-table'

type Client = {
  id: string
  name: string
  phone: string | null
  address?: string | null
  observations?: string | null
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
  name: string
  phone: string
  address: string
  observations: string
}

function emptyDraft(): Draft {
  return { name: '', phone: '', address: '', observations: '' }
}

export default function ClientsPage() {
  const qc = useQueryClient()
  const { language } = useSettings()
  const i = t(language)

  const [isOpen, setIsOpen] = useState(false)
  const draftStore = useDraftStorage<Draft>('draft:clients', emptyDraft)
  const draft = draftStore.value
  const setDraft = draftStore.setValue

  const clientsQ = useQuery({
    queryKey: ['clients'],
    queryFn: () => api<{ clients: Client[] }>('/api/clients'),
  })

  const createM = useMutation({
    mutationFn: (payload: {
      name: string
      phone: string | null
      address: string | null
      observations: string | null
    }) =>
      api<{ client: Client }>('/api/clients', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['clients'] })
    },
  })

  const updateM = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Client> }) =>
      api<{ client: Client }>(`/api/clients/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['clients'] })
      await qc.invalidateQueries({ queryKey: ['orders'] })
    },
  })

  const deleteM = useMutation({
    mutationFn: (id: string) => api<{ ok: true }>(`/api/clients/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['clients'] })
      await qc.invalidateQueries({ queryKey: ['orders'] })
    },
  })

  const clients = clientsQ.data?.clients ?? []

  function openCreate() {
    draftStore.clear()
    setIsOpen(true)
  }

  function openEdit(c: Client) {
    setDraft({
      id: c.id,
      name: c.name,
      phone: c.phone ?? '',
      address: c.address ?? '',
      observations: c.observations ?? '',
    })
    setIsOpen(true)
  }

  async function save() {
    const name = draft.name.trim()
    if (!name) return

    const payload = {
      name,
      phone: draft.phone.trim() ? draft.phone.trim() : null,
      address: draft.address.trim() ? draft.address.trim() : null,
      observations: draft.observations.trim() ? draft.observations.trim() : null,
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
    if (!confirm(i.clients.deleteConfirm)) return
    await deleteM.mutateAsync(draft.id)
    setIsOpen(false)
    draftStore.clear()
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{i.clients.title}</h1>
          <p className="text-sm text-neutral-600">{i.clients.subtitle}</p>
        </div>

        <button
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90"
          onClick={openCreate}
          type="button"
        >
          {i.clients.new}
        </button>
      </header>

      {clientsQ.isLoading ? (
        <p className="text-sm text-neutral-600">Carregando…</p>
      ) : clientsQ.isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Erro ao carregar: {String(clientsQ.error)}
        </div>
      ) : (
        <DataTable
          rows={clients}
          empty={i.clients.empty}
          labels={i.table}
          initialSort={{ key: 'name', dir: 'asc' }}
          onRowClick={openEdit}
          columns={[
            {
              key: 'name',
              header: language === 'pt' ? 'Nome' : language === 'es' ? 'Nombre' : 'Name',
              sortValue: (r) => r.name,
              searchValue: (r) => r.name,
              render: (r) => <div className="font-medium text-[var(--foreground)]">{r.name}</div>,
            },
            {
              key: 'phone',
              header: language === 'pt' ? 'Telefone' : language === 'es' ? 'Teléfono' : 'Phone',
              sortValue: (r) => r.phone ?? '',
              searchValue: (r) => r.phone ?? '',
              render: (r) => (
                <div className="text-[var(--muted-foreground)]">
                  {r.phone ? r.phone : i.clients.noPhone}
                </div>
              ),
            },
            {
              key: 'notes',
              header: language === 'pt' ? 'Obs.' : language === 'es' ? 'Notas' : 'Notes',
              sortValue: (r) => r.observations ?? '',
              searchValue: (r) => r.observations ?? '',
              render: (r) => (
                <div className="max-w-[32ch] truncate text-[var(--muted-foreground)]">
                  {r.observations ?? '—'}
                </div>
              ),
            },
          ]}
        />
      )}

      {isOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsOpen(false)} />
          <div className="surface absolute bottom-0 left-0 right-0 mx-auto w-full max-w-2xl rounded-t-2xl border border-theme p-5 shadow-xl sm:bottom-auto sm:top-20 sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{draft.id ? i.clients.editTitle : i.clients.newTitle}</h2>
                <p className="text-sm text-[var(--text-muted)]">{i.clients.modalSubtitle}</p>
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
                <span className="text-xs font-medium text-[var(--foreground)]">{i.clients.nameLabel}</span>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-[var(--foreground)]">{i.clients.phoneLabel}</span>
                <input
                  value={draft.phone}
                  onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                  placeholder={i.modal.optional}
                  className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-[var(--foreground)]">{i.clients.addressLabel}</span>
                <input
                  value={draft.address}
                  onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
                  placeholder={i.modal.optional}
                  className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-[var(--foreground)]">{i.clients.observationsLabel}</span>
                <textarea
                  value={draft.observations}
                  onChange={(e) => setDraft((d) => ({ ...d, observations: e.target.value }))}
                  placeholder={i.modal.optional}
                  className="min-h-24 w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                />
              </label>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                className="rounded-lg border border-theme px-4 py-2 text-sm text-[var(--danger)] hover:bg-[var(--danger-bg)] disabled:opacity-50"
                onClick={remove}
                type="button"
                disabled={!draft.id || deleteM.isPending}
              >
                {i.clients.delete}
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
