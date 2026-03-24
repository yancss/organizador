'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useSettings } from '@/app/app/settings-context'
import { localeFromLanguage } from '@/app/app/money'
import { baseFieldLabel, formatAuditValue } from '@/app/app/audit-format'
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
  changes: Array<{ field: string; from: any; to: any }>
}

function formatUser(u?: { name: string | null; email: string | null } | null) {
  if (!u) return null
  return u.name || u.email || null
}

// value formatting lives in `@/app/app/audit-format`

export default function AuditPanel() {
  const qc = useQueryClient()
  const { language, currency } = useSettings()
  const moneyLocale = localeFromLanguage(language)
  const i = t(language)

  const [tab, setTab] = useState<'CRUD' | 'PERMISSIONS'>('CRUD')
  const [debug, setDebug] = useState(false)
  const [entityType, setEntityType] = useState('')
  const [entityId, setEntityId] = useState('')
  const [field, setField] = useState('')

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
    queryKey: ['audit-events', tab, debug, entityType, entityId, field],
    queryFn: () => {
      const p = new URLSearchParams()
      p.set('category', tab)
      p.set('take', '80')
      p.set('debug', debug ? '1' : '0')
      if (entityType.trim()) p.set('entityType', entityType.trim())
      if (entityId.trim()) p.set('entityId', entityId.trim())
      if (field.trim()) p.set('field', field.trim())
      return api(`/api/admin/audit/events?${p.toString()}`)
    },
  })

  const items = eventsQ.data?.items ?? []

  const productIds = useMemo(() => {
    const ids = new Set<string>()
    for (const ev of items) {
      for (const c of ev.changes ?? []) {
        const m = String(c.field || '').match(/^items\.([A-Z]{3}\d{10})\./)
        if (m?.[1]) ids.add(m[1])
      }
    }
    return [...ids]
  }, [items])

  const productLookupQ = useQuery<{ items: Array<{ id: string; name: string | null }> }>({
    queryKey: ['lookup', 'Product', productIds.join(',')],
    enabled: productIds.length > 0,
    queryFn: () => api(`/api/lookup/entities?model=Product&ids=${encodeURIComponent(productIds.join(','))}`),
  })

  const productsById = useMemo(() => {
    const map = new Map<string, string>()
    for (const it of productLookupQ.data?.items ?? []) if (it?.id) map.set(it.id, it.name ?? it.id)
    return map
  }, [productLookupQ.data])

  function fieldLabel(raw: string) {
    const f = String(raw || '')

    const m = f.match(/^items\.([A-Z]{3}\d{10})\.(.+)$/)
    if (m) {
      const pid = m[1]
      const rest = m[2]
      const pname = productsById.get(pid) ?? pid
      const restMap: Record<string, string> = {
        unitPrice: 'Preço un.',
        quantity: 'Quantidade',
        discountType: 'Tipo desc.',
        discountValue: 'Desc. (valor)',
        discountPercent: 'Desc. (%)',
        added: 'Adicionado',
        removed: 'Removido',
      }
      const label = restMap[rest] ?? rest
      return `${pname} • ${label}`
    }

    return baseFieldLabel(f)
  }

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

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
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

          <label className="ml-auto flex items-center gap-2 text-sm">
            <input type="checkbox" checked={debug} onChange={(e) => setDebug(e.target.checked)} />
            Modo debug
          </label>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <input
            className="h-9 rounded-md border px-2 text-sm"
            placeholder="EntityType (ex.: SalesOrder)"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
          />
          <input
            className="h-9 rounded-md border px-2 text-sm"
            placeholder="EntityId (ex.: SOR0000000001)"
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
          />
          <input
            className="h-9 rounded-md border px-2 text-sm"
            placeholder="Campo (ex.: status)"
            value={field}
            onChange={(e) => setField(e.target.value)}
          />
        </div>
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

                {it.changes?.length ? (
                  <div className="mt-2 overflow-x-auto rounded-md bg-[var(--muted)] p-2 text-xs">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-[11px] text-[var(--text-muted)]">
                          <th className="py-1 pr-3">Campo</th>
                          <th className="py-1 pr-3">De</th>
                          <th className="py-1 pr-3">Para</th>
                        </tr>
                      </thead>
                      <tbody>
                        {it.changes.slice(0, 10).map((c, idx) => (
                          <tr key={idx} className="border-t border-theme">
                            <td className="py-1 pr-3 font-medium text-[var(--foreground)]">{fieldLabel(c.field)}</td>
                            <td className="py-1 pr-3 text-[var(--text-muted)]">{formatAuditValue(c.field, c.from, moneyLocale, currency)}</td>
                            <td className="py-1 pr-3 text-[var(--foreground)]">{formatAuditValue(c.field, c.to, moneyLocale, currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {it.changes.length > 10 ? (
                      <div className="mt-2 text-[11px] text-[var(--text-muted)]">+{it.changes.length - 10} mudanças…</div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
