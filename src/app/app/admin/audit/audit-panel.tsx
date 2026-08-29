'use client'

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, CalendarRange, Filter, UserRound } from 'lucide-react'
import { useMemo, useState } from 'react'

import { api } from '@/app/app/api-client'
import { baseFieldLabel, formatAuditValue } from '@/app/app/audit-format'
import { t } from '@/app/app/i18n'
import { localeFromLanguage } from '@/app/app/money'
import { useSettings } from '@/app/app/settings-context'
import { toast } from '@/app/app/toast'

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

type AuditResponse = {
  items: AuditItem[]
  nextCursor: string | null
}

function formatUser(u?: { name: string | null; email: string | null } | null) {
  if (!u) return null
  return u.name || u.email || null
}

function uiText(language: string) {
  if (language === 'pt') {
    return {
      title: 'Auditoria de acoes no workspace atual.',
      retentionTitle: 'Retencao de logs',
      retentionSubtitle: 'Define por quanto tempo os eventos de auditoria ficam salvos por workspace.',
      currentPage: 'eventos na consulta',
      changedFields: 'campos com alteracoes',
      actors: 'usuarios envolvidos',
      filtersTitle: 'Filtros operacionais',
      filtersSubtitle: 'Refine por tipo, periodo, ator ou entidade para chegar mais rapido no evento certo.',
      tabCrud: 'Registros',
      tabPermissions: 'Permissoes',
      debug: 'Modo debug',
      actor: 'Quem executou',
      anyActor: 'Todos os usuarios',
      entityType: 'Tipo de entidade',
      entityTypePlaceholder: 'Ex.: SalesOrder',
      entityId: 'ID da entidade',
      entityIdPlaceholder: 'Ex.: SOR0000000001',
      field: 'Campo com alteracao',
      fieldPlaceholder: 'Ex.: status',
      from: 'De',
      to: 'Ate',
      clearFilters: 'Limpar filtros',
      empty: 'Nenhum evento encontrado para o filtro atual.',
      loadMore: 'Carregar mais',
      loadingMore: 'Carregando...',
      noMore: 'Fim da lista atual.',
      actorLabel: 'Quem',
      targetLabel: 'Alvo',
      entityLabel: 'Entidade',
      changesTitle: 'Alteracoes',
      changeCount: (count: number) => `${count} alteracao${count === 1 ? '' : 'es'}`,
      unknownEntity: 'Sem entidade',
      failedToLoad: 'Erro ao carregar auditorias.',
      saved: 'Configuracao salva.',
      saveFailed: 'Falha ao salvar.',
      auth: 'Autenticacao',
      quickFilters: 'Atalhos operacionais',
      quickSales: 'Pedidos de venda',
      quickPurchases: 'Pedidos de compra',
      quickRoles: 'Roles e permissoes',
      quickUsers: 'Usuarios',
    }
  }
  if (language === 'es') {
    return {
      title: 'Auditoria de acciones en el workspace actual.',
      retentionTitle: 'Retencion de logs',
      retentionSubtitle: 'Define por cuanto tiempo se guardan los eventos de auditoria por workspace.',
      currentPage: 'eventos en la consulta',
      changedFields: 'campos con alteraciones',
      actors: 'usuarios involucrados',
      filtersTitle: 'Filtros operativos',
      filtersSubtitle: 'Refina por tipo, periodo, actor o entidad para encontrar mas rapido el evento correcto.',
      tabCrud: 'Registros',
      tabPermissions: 'Permisos',
      debug: 'Modo debug',
      actor: 'Quien ejecuto',
      anyActor: 'Todos los usuarios',
      entityType: 'Tipo de entidad',
      entityTypePlaceholder: 'Ej.: SalesOrder',
      entityId: 'ID de la entidad',
      entityIdPlaceholder: 'Ej.: SOR0000000001',
      field: 'Campo modificado',
      fieldPlaceholder: 'Ej.: status',
      from: 'Desde',
      to: 'Hasta',
      clearFilters: 'Limpiar filtros',
      empty: 'No se encontraron eventos para el filtro actual.',
      loadMore: 'Cargar mas',
      loadingMore: 'Cargando...',
      noMore: 'Fin de la lista actual.',
      actorLabel: 'Quien',
      targetLabel: 'Objetivo',
      entityLabel: 'Entidad',
      changesTitle: 'Alteraciones',
      changeCount: (count: number) => `${count} alteracion${count === 1 ? '' : 'es'}`,
      unknownEntity: 'Sin entidad',
      failedToLoad: 'Error al cargar auditorias.',
      saved: 'Configuracion guardada.',
      saveFailed: 'Error al guardar.',
      auth: 'Autenticacion',
      quickFilters: 'Atajos operativos',
      quickSales: 'Pedidos de venta',
      quickPurchases: 'Pedidos de compra',
      quickRoles: 'Roles y permisos',
      quickUsers: 'Usuarios',
    }
  }
  return {
    title: 'Audit log for the current workspace.',
    retentionTitle: 'Log retention',
    retentionSubtitle: 'Defines how long audit events stay stored per workspace.',
    currentPage: 'events in view',
    changedFields: 'changed fields',
    actors: 'users involved',
    filtersTitle: 'Operational filters',
    filtersSubtitle: 'Refine by type, period, actor, or entity to find the right event faster.',
    tabCrud: 'Records',
    tabPermissions: 'Permissions',
    debug: 'Debug mode',
    actor: 'Actor',
    anyActor: 'All users',
    entityType: 'Entity type',
    entityTypePlaceholder: 'Ex.: SalesOrder',
    entityId: 'Entity ID',
    entityIdPlaceholder: 'Ex.: SOR0000000001',
    field: 'Changed field',
    fieldPlaceholder: 'Ex.: status',
    from: 'From',
    to: 'To',
    clearFilters: 'Clear filters',
    empty: 'No events found for the current filter.',
    loadMore: 'Load more',
    loadingMore: 'Loading...',
    noMore: 'End of current list.',
    actorLabel: 'Actor',
    targetLabel: 'Target',
    entityLabel: 'Entity',
      changesTitle: 'Alterations',
    changeCount: (count: number) => `${count} change${count === 1 ? '' : 's'}`,
    unknownEntity: 'No entity',
    failedToLoad: 'Failed to load audit events.',
    saved: 'Settings saved.',
    saveFailed: 'Failed to save.',
    auth: 'Authentication',
    quickFilters: 'Operational shortcuts',
    quickSales: 'Sales orders',
    quickPurchases: 'Purchase orders',
    quickRoles: 'Roles and permissions',
    quickUsers: 'Users',
  }
}

function actionTone(action: AuditItem['action']) {
  if (action === 'CREATE' || action === 'GRANT') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (action === 'DELETE' || action === 'REVOKE') return 'border-rose-200 bg-rose-50 text-rose-700'
  return 'border-amber-200 bg-amber-50 text-amber-700'
}

function categoryTone(category: AuditItem['category']) {
  if (category === 'PERMISSIONS') return 'border-sky-200 bg-sky-50 text-sky-700'
  if (category === 'AUTH') return 'border-violet-200 bg-violet-50 text-violet-700'
  return 'border-theme bg-[var(--surface-2)] text-[var(--foreground)]'
}

export default function AuditPanel() {
  const qc = useQueryClient()
  const { language, currency } = useSettings()
  const moneyLocale = localeFromLanguage(language)
  const i = t(language)
  const copy = uiText(language)

  const [tab, setTab] = useState<'CRUD' | 'PERMISSIONS'>('CRUD')
  const [debug, setDebug] = useState(false)
  const [entityType, setEntityType] = useState('')
  const [entityId, setEntityId] = useState('')
  const [field, setField] = useState('')
  const [actorUserId, setActorUserId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const retentionQ = useQuery<{ months: 3 | 6 | 12 }>({
    queryKey: ['audit-retention'],
    queryFn: () => api('/api/admin/settings/audit-retention'),
  })

  const usersQ = useQuery<{ users: Array<{ id: string; name: string | null; email: string | null }> }>({
    queryKey: ['admin-users-lookup'],
    queryFn: () => api('/api/admin/users'),
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
      toast.success(copy.saved)
    },
    onError: (err: any) => toast.error(err?.message || copy.saveFailed),
  })

  const filters = useMemo(
    () => ({
      tab,
      debug,
      entityType: entityType.trim(),
      entityId: entityId.trim(),
      field: field.trim(),
      actorUserId: actorUserId.trim(),
      from: from.trim(),
      to: to.trim(),
    }),
    [actorUserId, debug, entityId, entityType, field, from, tab, to],
  )

  const eventsQ = useInfiniteQuery({
    queryKey: ['audit-events', filters],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const p = new URLSearchParams()
      p.set('category', filters.tab)
      p.set('take', '40')
      p.set('debug', filters.debug ? '1' : '0')
      if (filters.entityType) p.set('entityType', filters.entityType)
      if (filters.entityId) p.set('entityId', filters.entityId)
      if (filters.field) p.set('field', filters.field)
      if (filters.actorUserId) p.set('actorUserId', filters.actorUserId)
      if (filters.from) p.set('from', new Date(filters.from).toISOString())
      if (filters.to) p.set('to', new Date(filters.to).toISOString())
      if (pageParam) p.set('cursor', pageParam)
      return api<AuditResponse>(`/api/admin/audit/events?${p.toString()}`)
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })

  const items = useMemo(() => eventsQ.data?.pages.flatMap((page) => page.items) ?? [], [eventsQ.data])

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
    for (const it of productLookupQ.data?.items ?? []) {
      if (it?.id) map.set(it.id, it.name ?? it.id)
    }
    return map
  }, [productLookupQ.data])

  const usersById = useMemo(() => {
    const map = new Map<string, { name: string | null; email: string | null }>()
    for (const u of usersQ.data?.users ?? []) {
      map.set(u.id, { name: u.name, email: u.email })
    }
    return map
  }, [usersQ.data])

  const stats = useMemo(() => {
    const actorIds = new Set<string>()
    let changedFields = 0
    for (const item of items) {
      if (item.actorUserId) actorIds.add(item.actorUserId)
      if (item.targetUserId) actorIds.add(item.targetUserId)
      changedFields += item.changes?.length ?? 0
    }
    return {
      total: items.length,
      changedFields,
      actorCount: actorIds.size,
    }
  }, [items])

  function fieldLabel(raw: string) {
    const f = String(raw || '')
    const m = f.match(/^items\.([A-Z]{3}\d{10})\.(.+)$/)
    if (m) {
      const pid = m[1]
      const rest = m[2]
      const pname = productsById.get(pid) ?? pid
      const restMap: Record<string, string> = {
        unitPrice: 'Preco un.',
        quantity: 'Quantidade',
        discountType: 'Tipo desc.',
        discountValue: 'Desc. (valor)',
        discountPercent: 'Desc. (%)',
        added: 'Adicionado',
        removed: 'Removido',
      }
      const label = restMap[rest] ?? rest
      return `${pname} | ${label}`
    }

    return baseFieldLabel(f)
  }

  function renderUser(id: string | null) {
    if (!id) return '—'
    const u = usersById.get(id)
    return formatUser(u) || i.common.audit.unknownUser
  }

  function clearFilters() {
    setEntityType('')
    setEntityId('')
    setField('')
    setActorUserId('')
    setFrom('')
    setTo('')
    setDebug(false)
  }

  function applyQuickEntity(nextEntityType: string) {
    setEntityType(nextEntityType)
    setEntityId('')
    setField('')
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-theme bg-[var(--surface-2)] px-5 py-5 shadow-[var(--shadow-sm)]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Audit center</div>
        <h1 className="mt-2 text-xl font-semibold">{i.nav.adminAudits}</h1>
        <p className="mt-1 max-w-3xl text-sm text-[var(--text-muted)]">{copy.title}</p>
      </div>

      <div className="grid gap-3 xl:grid-cols-4">
        <div className="surface rounded-2xl border border-theme p-4 xl:col-span-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">{copy.retentionTitle}</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">{copy.retentionSubtitle}</p>
            </div>
            <CalendarRange className="size-5 text-[var(--text-muted)]" />
          </div>
          <div className="mt-4">
            <select
              className="h-10 w-full rounded-md border border-theme bg-transparent px-3 text-sm"
              value={retentionQ.data?.months ?? 3}
              onChange={(e) => setRetentionMutation.mutate(Number(e.target.value) as 3 | 6 | 12)}
              disabled={setRetentionMutation.isPending}
            >
              <option value={3}>3 meses</option>
              <option value={6}>6 meses</option>
              <option value={12}>12 meses</option>
            </select>
          </div>
        </div>

        <div className="surface rounded-2xl border border-theme p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[var(--surface-3)] p-2 text-[var(--primary)]">
              <Activity className="size-4" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{copy.currentPage}</div>
              <div className="text-2xl font-semibold">{stats.total}</div>
            </div>
          </div>
        </div>

        <div className="surface rounded-2xl border border-theme p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[var(--surface-3)] p-2 text-amber-700">
              <Filter className="size-4" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{copy.changedFields}</div>
              <div className="text-2xl font-semibold">{stats.changedFields}</div>
            </div>
          </div>
        </div>

        <div className="surface rounded-2xl border border-theme p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[var(--surface-3)] p-2 text-sky-700">
              <UserRound className="size-4" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{copy.actors}</div>
              <div className="text-2xl font-semibold">{stats.actorCount}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="surface rounded-2xl border border-theme p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-sm font-semibold">{copy.filtersTitle}</div>
            <div className="mt-1 text-xs text-[var(--text-muted)]">{copy.filtersSubtitle}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className={`btn ${tab === 'CRUD' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTab('CRUD')}
            >
              {copy.tabCrud}
            </button>
            <button
              className={`btn ${tab === 'PERMISSIONS' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTab('PERMISSIONS')}
            >
              {copy.tabPermissions}
            </button>
            <label className="btn btn-secondary cursor-pointer">
              <input type="checkbox" checked={debug} onChange={(e) => setDebug(e.target.checked)} />
              {copy.debug}
            </label>
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-[var(--surface-2)] p-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
            {copy.quickFilters}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button className="btn btn-secondary" onClick={() => applyQuickEntity('SalesOrder')}>
              {copy.quickSales}
            </button>
            <button className="btn btn-secondary" onClick={() => applyQuickEntity('PurchaseOrder')}>
              {copy.quickPurchases}
            </button>
            <button className="btn btn-secondary" onClick={() => applyQuickEntity('WorkspaceRoleModel')}>
              {copy.quickRoles}
            </button>
            <button className="btn btn-secondary" onClick={() => applyQuickEntity('User')}>
              {copy.quickUsers}
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-1">
            <span className="text-xs text-[var(--text-muted)]">{copy.actor}</span>
            <select
              className="h-10 rounded-md border border-theme bg-transparent px-3 text-sm"
              value={actorUserId}
              onChange={(e) => setActorUserId(e.target.value)}
            >
              <option value="">{copy.anyActor}</option>
              {(usersQ.data?.users ?? []).map((user) => (
                <option key={user.id} value={user.id}>
                  {formatUser(user) || user.id}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-xs text-[var(--text-muted)]">{copy.entityType}</span>
            <input
              className="h-10 rounded-md border border-theme bg-transparent px-3 text-sm"
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              placeholder={copy.entityTypePlaceholder}
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs text-[var(--text-muted)]">{copy.entityId}</span>
            <input
              className="h-10 rounded-md border border-theme bg-transparent px-3 text-sm"
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              placeholder={copy.entityIdPlaceholder}
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs text-[var(--text-muted)]">{copy.field}</span>
            <input
              className="h-10 rounded-md border border-theme bg-transparent px-3 text-sm"
              value={field}
              onChange={(e) => setField(e.target.value)}
              placeholder={copy.fieldPlaceholder}
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs text-[var(--text-muted)]">{copy.from}</span>
            <input
              className="h-10 rounded-md border border-theme bg-transparent px-3 text-sm"
              type="datetime-local"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs text-[var(--text-muted)]">{copy.to}</span>
            <input
              className="h-10 rounded-md border border-theme bg-transparent px-3 text-sm"
              type="datetime-local"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>

        <div className="mt-4 flex justify-end">
          <button className="btn btn-secondary" onClick={clearFilters}>
            {copy.clearFilters}
          </button>
        </div>
      </div>

      <div className="surface rounded-2xl border border-theme p-4">
        {eventsQ.isLoading ? (
          <p className="text-sm text-[var(--text-muted)]">{i.common.loading}</p>
        ) : eventsQ.error ? (
          <p className="text-sm text-red-600">{copy.failedToLoad}</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">{copy.empty}</p>
        ) : (
          <div className="grid gap-3">
            {items.map((item) => (
              <article key={item.id} className="rounded-2xl border border-theme bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${actionTone(item.action)}`}>
                        {item.action}
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${categoryTone(item.category)}`}>
                        {item.category === 'AUTH' ? copy.auth : item.category}
                      </span>
                      {item.changes?.length ? (
                        <span className="rounded-full border border-theme px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)]">
                          {copy.changeCount(item.changes.length)}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 text-sm font-semibold">
                      {item.summary || `${item.action} ${item.entityType || copy.unknownEntity}`}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
                      <span><span className="text-[var(--foreground)]">{copy.actorLabel}:</span> {renderUser(item.actorUserId)}</span>
                      {item.targetUserId ? (
                        <span><span className="text-[var(--foreground)]">{copy.targetLabel}:</span> {renderUser(item.targetUserId)}</span>
                      ) : null}
                      {item.entityType ? (
                        <span>
                          <span className="text-[var(--foreground)]">{copy.entityLabel}:</span> {item.entityType}
                          {item.entityId ? ` #${item.entityId}` : ''}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="text-xs text-[var(--text-muted)]">{new Date(item.createdAt).toLocaleString()}</div>
                </div>

                {item.changes?.length ? (
                  <details className="mt-3 rounded-xl bg-[var(--surface-2)] p-3">
                    <summary className="cursor-pointer text-sm font-medium">{copy.changesTitle}</summary>
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-[11px] text-[var(--text-muted)]">
                            <th className="py-1 pr-3">Campo</th>
                            <th className="py-1 pr-3">De</th>
                            <th className="py-1 pr-3">Para</th>
                          </tr>
                        </thead>
                        <tbody>
                          {item.changes.map((change, idx) => (
                            <tr key={`${item.id}-${idx}`} className="border-t border-theme align-top">
                              <td className="py-2 pr-3 font-medium text-[var(--foreground)]">{fieldLabel(change.field)}</td>
                              <td className="py-2 pr-3 text-[var(--text-muted)]">
                                {formatAuditValue(change.field, change.from, moneyLocale, currency)}
                              </td>
                              <td className="py-2 pr-3 text-[var(--foreground)]">
                                {formatAuditValue(change.field, change.to, moneyLocale, currency)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                ) : null}
              </article>
            ))}

            <div className="flex items-center justify-between gap-3 pt-2">
              <div className="text-xs text-[var(--text-muted)]">
                {eventsQ.hasNextPage ? copy.loadMore : copy.noMore}
              </div>
              <button
                className="btn btn-secondary"
                disabled={!eventsQ.hasNextPage || eventsQ.isFetchingNextPage}
                onClick={() => eventsQ.fetchNextPage()}
              >
                {eventsQ.isFetchingNextPage ? copy.loadingMore : copy.loadMore}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
