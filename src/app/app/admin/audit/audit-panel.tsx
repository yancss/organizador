'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useSettings } from '@/app/app/settings-context'
import { t } from '@/app/app/i18n'
import { toast } from '@/app/app/toast'
import { api } from '@/app/app/api-client'

type AuditItem = {
  id: string
  createdAt: string
  category: 'CRUD' | 'PERMISSIONS' | 'AUTH'
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'GRANT' | 'REVOKE'
  actorUserId: string | null
  targetUserId: string | null
  entityType: string | null
  entityId: string | null
  summary: string | null
  changes: any
}

function formatUser(u?: { name: string | null; email: string | null } | null) {
  if (!u) return null
  return u.name || u.email || null
}

export default function AuditPanel() {
  const qc = useQueryClient()
  const { language } = useSettings()
  const i = t(language)

  const [tab, setTab] = useState<'CRUD' | 'PERMISSIONS'>('CRUD')

  const retentionQ = useQuery<{ months: 3 | 6 | 12 }>({
    queryKey: ['audit-retention'],
    queryFn: () => api('/api/admin/settings/audit-retention'),
  })

  const setRetentionMutation = useMutation({
    mutationFn: async (months: 3 | 6 | 12) => {
      return api('/api/admin/settings/audit-retention', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ months }),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit-retention'] })
      toast.success('Configuração salva.')
    },
    onError: (err: any) => toast.error(err?.message || 'Falha ao salvar'),
  })

  const eventsQ = useQuery<{ items: AuditItem[]; nextCursor: string | null }>({
    queryKey: ['audit-events', tab],
    queryFn: () => api(`/api/admin/audit/events?category=${encodeURIComponent(tab)}&take=80`),
  })

  const items = eventsQ.data?.items ?? []

  const userIds = useMemo(() => {
    const ids = new Set<string>()
    for (const it of items) {
      if (it.actorUserId) ids.add(it.actorUserId)
      if (it.targetUserId) ids.add(it.targetUserId)
    }
    return [...ids]
  }, [items])

  const usersQ = useQuery<{ users: Array<{ id: string; name: string | null; email: string | null }> }>({
    queryKey: ['users-lookup', userIds.join(',')],
    enabled: userIds.length > 0,
    queryFn: () => api(`/api/users/lookup?ids=${encodeURIComponent(userIds.join(','))}`),
  })

  const usersById = useMemo(() => {
    const map = new Map<string, { name: string | null; email: string | null }>()
    for (const u of usersQ.data?.users ?? []) map.set(u.id, { name: u.name, email: u.email })
    return map
  }, [usersQ.data])

  function renderUser(id: string | null) {
    if (!id) return '—'
    const u = usersById.get(id)
    return formatUser(u) || i.common.audit.unknownUser
  }

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-xl font-semibold">{i.nav.adminAudits}</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Auditoria de ações no workspace atual.</p>
      </div>

      <div className="rounded-xl border p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Retenção de logs</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Define por quanto tempo os eventos de auditoria ficam salvos (por workspace).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              className="h-9 rounded-md border px-2 text-sm"
              value={retentionQ.data?.months ?? 3}
              onChange={(e) => setRetentionMutation.mutate(Number(e.target.value) as 3 | 6 | 12)}
              disabled={setRetentionMutation.isPending}
            >
              <option value={3}>3 meses (padrão)</option>
              <option value={6}>6 meses</option>
              <option value={12}>12 meses</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          className={
            'h-9 rounded-md border px-3 text-sm ' +
            (tab === 'CRUD' ? 'bg-[var(--muted)]' : 'bg-transparent hover:bg-[var(--muted)]')
          }
          onClick={() => setTab('CRUD')}
        >
          Registros (CRUD)
        </button>
        <button
          className={
            'h-9 rounded-md border px-3 text-sm ' +
            (tab === 'PERMISSIONS' ? 'bg-[var(--muted)]' : 'bg-transparent hover:bg-[var(--muted)]')
          }
          onClick={() => setTab('PERMISSIONS')}
        >
          Permissões
        </button>
      </div>

      <div className="rounded-xl border p-4">
        {eventsQ.isLoading ? (
          <p className="text-sm text-[var(--text-muted)]">{i.common.loading}</p>
        ) : eventsQ.error ? (
          <p className="text-sm text-red-600">Erro ao carregar auditorias.</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Nenhum evento ainda.</p>
        ) : (
          <div className="grid gap-2">
            {items.map((it) => (
              <div key={it.id} className="rounded-lg border p-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm font-medium">{it.summary || `${it.action} ${it.entityType || ''}`}</div>
                  <div className="text-xs text-[var(--text-muted)]">{new Date(it.createdAt).toLocaleString()}</div>
                </div>

                <div className="mt-1 text-xs text-[var(--text-muted)]">
                  <span className="text-[var(--foreground)]">Quem:</span> {renderUser(it.actorUserId)}
                  {it.targetUserId ? (
                    <>
                      {' '}
                      · <span className="text-[var(--foreground)]">Alvo:</span> {renderUser(it.targetUserId)}
                    </>
                  ) : null}
                  {it.entityType ? (
                    <>
                      {' '}
                      · <span className="text-[var(--foreground)]">Entidade:</span> {it.entityType}
                      {it.entityId ? `#${it.entityId}` : ''}
                    </>
                  ) : null}
                </div>

                {it.changes ? (
                  <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-[var(--muted)] p-2 text-[11px]">
                    {JSON.stringify(it.changes, null, 2)}
                  </pre>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
