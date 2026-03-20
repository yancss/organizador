'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { t } from '../../i18n'
import { useSettings } from '../../settings-context'
import DataTable from '../../ui/data-table'
import { toastCreated, toastUpdated, toastDeleted, toastFailedToSave, toastFailedToDelete } from '../../toast'
import { api } from '../../api-client'

type Account = {
  id: string
  name: string
  kind: string
  active: boolean
  openingBalance: string | null
}

// (moved to api-client.ts)


export default function FinanceAccountsPage() {
  const qc = useQueryClient()
  const { language } = useSettings()
  const i = t(language)

  const accountsQ = useQuery({
    queryKey: ['finance', 'accounts'],
    queryFn: () => api<{ accounts: Account[] }>('/api/finance/accounts'),
  })

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [create, setCreate] = useState({ name: '', kind: 'CASH', openingBalance: '' })

  const createM = useMutation({
    mutationFn: (payload: { name: string; kind?: string; openingBalance?: number | null }) =>
      api<{ account: Account }>('/api/finance/accounts', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['finance', 'accounts'] })
    },
  })

  const patchM = useMutation({
    mutationFn: (payload: { id: string; name?: string; kind?: string; active?: boolean; openingBalance?: number | null }) =>
      api<{ account: Account }>(`/api/finance/accounts/${payload.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: payload.name,
          kind: payload.kind,
          active: payload.active,
          openingBalance: payload.openingBalance,
        }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['finance', 'accounts'] })
    },
  })

  const deleteM = useMutation({
    mutationFn: (id: string) =>
      api<{ ok: true }>(`/api/finance/accounts/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['finance', 'accounts'] })
    },
  })

  const accounts = accountsQ.data?.accounts ?? []

  const rows = useMemo(() => accounts, [accounts])

  async function doCreate() {
    const name = create.name.trim()
    if (!name) return

    const openingBalanceRaw = create.openingBalance.trim()
    const openingBalance = openingBalanceRaw ? Number(openingBalanceRaw.replace(',', '.')) : null

    try {
      await createM.mutateAsync({
        name,
        kind: create.kind,
        openingBalance: openingBalanceRaw ? openingBalance : null,
      })
      toastCreated(i, 'account')
      setIsCreateOpen(false)
      setCreate({ name: '', kind: 'CASH', openingBalance: '' })
    } catch (e: any) {
      toastFailedToSave(i, String(e?.message ?? ''))
    }
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
            {language === 'pt' ? 'Contas' : language === 'es' ? 'Cuentas' : 'Accounts'}
          </h1>
          <p className="text-sm text-neutral-600">
            {language === 'pt'
              ? 'Gerencie as contas (Banco, Caixa, Cartão…).'
              : language === 'es'
                ? 'Gestiona tus cuentas (Banco, Caja…).'
                : 'Manage accounts (bank, cash, card…).'}
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => setIsCreateOpen(true)}
          type="button"
        >
          {language === 'pt' ? 'Nova conta' : language === 'es' ? 'Nueva cuenta' : 'New account'}
        </button>
      </header>

      {accountsQ.isLoading ? (
        <p className="text-sm text-neutral-600">Carregando…</p>
      ) : accountsQ.isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Erro ao carregar: {String(accountsQ.error)}
        </div>
      ) : (
        <DataTable
          rows={rows}
          empty={language === 'pt' ? 'Nenhuma conta.' : language === 'es' ? 'Sin cuentas.' : 'No accounts.'}
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
              key: 'kind',
              header: language === 'pt' ? 'Tipo' : language === 'es' ? 'Tipo' : 'Kind',
              sortValue: (r) => r.kind,
              searchValue: (r) => r.kind,
              render: (r) => <div className="text-[var(--muted-foreground)]">{r.kind}</div>,
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
                    patchM
                      .mutateAsync({ id: r.id, active: !r.active })
                      .then(() => toastUpdated(i, 'account'))
                      .catch((e: any) => toastFailedToSave(i, String(e?.message ?? '')))
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
                    className="btn btn-secondary btn-sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      const name = prompt(language === 'pt' ? 'Novo nome da conta:' : 'New account name:', r.name)
                      if (!name) return
                      patchM
                        .mutateAsync({ id: r.id, name })
                        .then(() => toastUpdated(i, 'account'))
                        .catch((e: any) => toastFailedToSave(i, String(e?.message ?? '')))
                    }}
                  >
                    {language === 'pt' ? 'Renomear' : language === 'es' ? 'Renombrar' : 'Rename'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger-soft btn-sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (
                        !confirm(
                          language === 'pt'
                            ? 'Desativar esta conta? (Ela não será apagada, só ficará inativa)'
                            : 'Disable this account?'
                        )
                      )
                        return
                      deleteM
                        .mutateAsync(r.id)
                        .then(() => toastDeleted(i, 'account'))
                        .catch((e: any) => toastFailedToDelete(i, String(e?.message ?? '')))
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

      {isCreateOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsCreateOpen(false)} />
          <div className="surface modal-safe absolute bottom-0 left-0 right-0 mx-auto w-full max-w-xl rounded-t-2xl border border-theme p-5 shadow-xl sm:bottom-auto sm:top-20 sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">
                  {language === 'pt' ? 'Nova conta' : language === 'es' ? 'Nueva cuenta' : 'New account'}
                </h2>
              </div>
              <button
                aria-label="Fechar"
                className="btn btn-secondary btn-icon"
                onClick={() => setIsCreateOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1">
                <span className="text-xs font-medium text-[var(--foreground)]">{language === 'pt' ? 'Nome' : 'Name'}</span>
                <input
                  value={create.name}
                  onChange={(e) => setCreate((s) => ({ ...s, name: e.target.value }))}
                  className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-[var(--foreground)]">{language === 'pt' ? 'Tipo' : 'Kind'}</span>
                  <select
                    value={create.kind}
                    onChange={(e) => setCreate((s) => ({ ...s, kind: e.target.value }))}
                    className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                  >
                    <option value="CASH">CASH</option>
                    <option value="BANK">BANK</option>
                    <option value="CARD">CARD</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-medium text-[var(--foreground)]">{language === 'pt' ? 'Saldo inicial (opcional)' : 'Opening balance (optional)'}</span>
                  <input
                    inputMode="decimal"
                    value={create.openingBalance}
                    onChange={(e) => setCreate((s) => ({ ...s, openingBalance: e.target.value }))}
                    className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                    placeholder={language === 'pt' ? '0,00' : '0.00'}
                  />
                </label>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                className="btn btn-secondary"
                onClick={() => setIsCreateOpen(false)}
                type="button"
              >
                {language === 'pt' ? 'Cancelar' : language === 'es' ? 'Cancelar' : 'Cancel'}
              </button>
              <button
                className="btn btn-primary"
                onClick={doCreate}
                type="button"
                disabled={!create.name.trim() || createM.isPending}
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
