'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { api } from './api-client'
import { baseFieldLabel, formatAuditValue } from './audit-format'
import { localeFromLanguage } from './money'
import { useSettings } from './settings-context'

type AuditRow = {
  id: string
  createdAt: string
  summary: string | null
  actorUserId: string | null
  changes: Array<{ field: string; from: any; to: any }>
}

function formatUser(u?: { name: string | null; email: string | null } | null) {
  if (!u) return null
  return u.name || u.email || null
}

export function AuditHistory({ entityType, entityId, take = 20, title }: { entityType: string; entityId: string; take?: number; title?: string }) {
  const { language, currency } = useSettings()
  const moneyLocale = localeFromLanguage(language)

  const auditQ = useQuery<{ items: AuditRow[]; nextCursor: string | null }>({
    queryKey: ['audit', entityType, entityId, take],
    enabled: Boolean(entityType && entityId),
    queryFn: () => api(`/api/audit/events?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}&take=${take}`),
  })

  const items = auditQ.data?.items ?? []

  const userIds = useMemo(() => {
    const ids = new Set<string>()
    for (const it of items) if (it.actorUserId) ids.add(it.actorUserId)
    return [...ids]
  }, [items])

  const usersQ = useQuery<{ users: Array<{ id: string; name: string | null; email: string | null }> }>({
    queryKey: ['users-lookup', 'audit', userIds.join(',')],
    enabled: userIds.length > 0,
    queryFn: () => api(`/api/users/lookup?ids=${encodeURIComponent(userIds.join(','))}`),
  })

  const usersById = useMemo(() => {
    const map = new Map<string, { name: string | null; email: string | null }>()
    for (const u of usersQ.data?.users ?? []) map.set(u.id, { name: u.name, email: u.email })
    return map
  }, [usersQ.data])

  // Collect ids for friendly labels (products, clients, finance lookups)
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

    // Items: items.<ProductId>.<prop>
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

  return (
    <div className="grid gap-2 rounded-lg border border-theme p-3">
      <div className="text-xs font-medium text-[var(--foreground)]">{title ?? (language === 'pt' ? 'Histórico' : language === 'es' ? 'Historial' : 'History')}</div>

      {auditQ.isLoading ? (
        <div className="text-sm text-[var(--muted-foreground)]">{language === 'pt' ? 'Carregando…' : language === 'es' ? 'Cargando…' : 'Loading…'}</div>
      ) : auditQ.isError ? (
        <div className="text-sm text-red-600">{language === 'pt' ? 'Erro ao carregar auditoria.' : language === 'es' ? 'Error al cargar auditoría.' : 'Failed to load audit.'}</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-[var(--muted-foreground)]">—</div>
      ) : (
        <div className="grid gap-2">
          {items.map((ev) => {
            const u = ev.actorUserId ? usersById.get(ev.actorUserId) : null
            const who = formatUser(u) || '—'

            return (
              <div key={ev.id} className="rounded-lg border border-theme px-3 py-2">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm font-medium text-[var(--foreground)]">{ev.summary ?? 'UPDATE'}</div>
                  <div className="text-xs text-[var(--muted-foreground)]">{new Date(ev.createdAt).toLocaleString()}</div>
                </div>

                <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                  <span className="text-[var(--foreground)]">{language === 'pt' ? 'Quem' : language === 'es' ? 'Quién' : 'Who'}:</span> {who}
                </div>

                {ev.changes?.length ? (
                  <div className="mt-2 overflow-x-auto rounded-md bg-[var(--muted)] p-2 text-xs">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-[11px] text-[var(--text-muted)]">
                          <th className="py-1 pr-3">{language === 'pt' ? 'Campo' : language === 'es' ? 'Campo' : 'Field'}</th>
                          <th className="py-1 pr-3">{language === 'pt' ? 'De' : language === 'es' ? 'De' : 'From'}</th>
                          <th className="py-1 pr-3">{language === 'pt' ? 'Para' : language === 'es' ? 'A' : 'To'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ev.changes.slice(0, 10).map((c, idx) => (
                          <tr key={idx} className="border-t border-theme">
                            <td className="py-1 pr-3 font-medium text-[var(--foreground)]">{fieldLabel(c.field)}</td>
                            <td className="py-1 pr-3 text-[var(--text-muted)]">{formatAuditValue(c.field, c.from, moneyLocale, currency)}</td>
                            <td className="py-1 pr-3 text-[var(--foreground)]">{formatAuditValue(c.field, c.to, moneyLocale, currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {ev.changes.length > 10 ? (
                      <div className="mt-2 text-[11px] text-[var(--text-muted)]">+{ev.changes.length - 10}…</div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
