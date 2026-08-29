'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, ShieldCheck, SlidersHorizontal, Users } from 'lucide-react'

import { ROLE_PERMISSION_MODULES } from '@/lib/access-control'
import { DEFAULT_WORKSPACE_ROLE_PRESETS } from '@/lib/default-workspace-roles'
import { t } from '@/app/app/i18n'
import { useSettings } from '@/app/app/settings-context'
import { toast } from '@/app/app/toast'

type Permission = {
  id: string
  key: string
  module: string
  action: string
  description: string | null
}

type Role = {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  permissions: Array<{ permission: Permission }>
}

const MODULE_LABEL: Record<string, keyof ReturnType<typeof t>['admin']['roles']['moduleNames']> = {
  sales: 'sales',
  purchases: 'purchases',
  inventory: 'inventory',
  products: 'products',
  clients: 'clients',
  finance: 'finance',
}

function isViewKey(k: string) {
  return k.endsWith('.view')
}

function isEditKey(k: string) {
  return k.endsWith('.edit')
}

function moduleFromKey(k: string) {
  return k.split('.')[0] || k
}

function moduleLabel(i: ReturnType<typeof t>, moduleKey: string) {
  if (moduleKey in MODULE_LABEL) {
    return i.admin.roles.moduleNames[MODULE_LABEL[moduleKey as keyof typeof MODULE_LABEL]]
  }
  if (moduleKey === 'workflow') return 'Workflow'
  return moduleKey
}

function uiText(language: string) {
  if (language === 'pt') {
    return {
      roleSummary: (viewCount: number, editCount: number) => `${viewCount} modulos com acesso | ${editCount} com edicao`,
      viewHelp: 'Pode abrir e consultar.',
      editHelp: 'Pode criar, alterar e executar acoes.',
      moduleNoAccess: 'Sem descricao operacional.',
      systemRoleHelp: 'Role de sistema protegida.',
      customRoleHelp: 'Role customizavel do workspace.',
      predefinedRoleHelp: 'Role operacional predefinida da organizacao.',
      permissionsLegend: 'Leitura e operacao por modulo.',
      defaultBadge: 'padrao',
    }
  }
  if (language === 'es') {
    return {
      roleSummary: (viewCount: number, editCount: number) => `${viewCount} modulos con acceso | ${editCount} con edicion`,
      viewHelp: 'Puede abrir y consultar.',
      editHelp: 'Puede crear, cambiar y ejecutar acciones.',
      moduleNoAccess: 'Sin descripcion operativa.',
      systemRoleHelp: 'Rol del sistema protegido.',
      customRoleHelp: 'Rol personalizable del workspace.',
      predefinedRoleHelp: 'Rol operativo predefinido de la organizacion.',
      permissionsLegend: 'Lectura y operacion por modulo.',
      defaultBadge: 'base',
    }
  }
  return {
    roleSummary: (viewCount: number, editCount: number) => `${viewCount} modules with access | ${editCount} with edit`,
    viewHelp: 'Can open and inspect.',
    editHelp: 'Can create, change, and execute actions.',
    moduleNoAccess: 'No operational description.',
    systemRoleHelp: 'Protected system role.',
    customRoleHelp: 'Workspace custom role.',
    predefinedRoleHelp: 'Predefined operational role for this organization.',
    permissionsLegend: 'Read and operate per module.',
    defaultBadge: 'default',
  }
}

export default function RolesPanel() {
  const qc = useQueryClient()
  const { language } = useSettings()
  const i = t(language)
  const copy = uiText(language)
  const predefinedRoleNames = useMemo(
    () => new Set(DEFAULT_WORKSPACE_ROLE_PRESETS.map((preset) => preset.name.trim().toLowerCase())),
    [],
  )

  const { data, isLoading, error } = useQuery<{ roles: Role[]; permissions: Permission[] }>({
    queryKey: ['admin-roles'],
    queryFn: async () => {
      const res = await fetch('/api/admin/roles', { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || 'FAILED_TO_LOAD')
      return json
    },
  })

  const roles = data?.roles ?? []
  const allPerms = data?.permissions ?? []

  const modules = useMemo(() => {
    const moduleSet = new Set<string>()
    for (const p of allPerms) {
      if (ROLE_PERMISSION_MODULES.includes(p.module as (typeof ROLE_PERMISSION_MODULES)[number])) {
        moduleSet.add(p.module)
      }
    }
    return [...moduleSet].sort((a, b) => a.localeCompare(b))
  }, [allPerms])

  const permsByKey = useMemo(() => {
    const map = new Map<string, Permission>()
    for (const p of allPerms) map.set(p.key, p)
    return map
  }, [allPerms])

  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleDesc, setNewRoleDesc] = useState('')

  const createRole = useMutation({
    mutationFn: async (args: { name: string; description?: string | null }) => {
      const res = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || 'FAILED_TO_CREATE')
      return json
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-roles'] }),
  })

  const savePerms = useMutation({
    mutationFn: async (args: { roleId: string; permissionKeys: string[] }) => {
      const res = await fetch(`/api/admin/roles/${args.roleId}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissionKeys: args.permissionKeys }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || 'FAILED_TO_SAVE')
      return json
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-roles'] }),
  })

  const [draft, setDraft] = useState<Record<string, Record<string, boolean>>>({})
  const [openRoleId, setOpenRoleId] = useState<string | null>(null)

  const overview = useMemo(() => {
    const predefinedCount = roles.filter((role) => predefinedRoleNames.has(role.name.trim().toLowerCase())).length
    const customCount = roles.filter((role) => !role.isSystem && !predefinedRoleNames.has(role.name.trim().toLowerCase())).length
    return {
      total: roles.length,
      predefined: predefinedCount,
      custom: customCount,
    }
  }, [predefinedRoleNames, roles])

  function hasPendingChanges(roleId: string) {
    const c = draft[roleId]
    if (!c) return false
    return Object.keys(c).length > 0
  }

  function selectedKeysForRole(role: Role) {
    const base = new Set(role.permissions.map((p) => p.permission.key))
    const changes = draft[role.id] || {}
    for (const [k, v] of Object.entries(changes)) {
      if (v) base.add(k)
      else base.delete(k)
    }
    return base
  }

  function setPerm(roleId: string, key: string, checked: boolean) {
    const mod = moduleFromKey(key)
    const viewKey = `${mod}.view`
    const editKey = `${mod}.edit`

    const updates: Record<string, boolean> = {}

    if (isEditKey(key) && checked) {
      updates[editKey] = true
      updates[viewKey] = true
    } else if (isViewKey(key) && !checked) {
      updates[viewKey] = false
      updates[editKey] = false
    } else {
      updates[key] = checked
    }

    setDraft((prev) => ({
      ...prev,
      [roleId]: { ...(prev[roleId] || {}), ...updates },
    }))
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-theme bg-[var(--surface-2)] px-5 py-5 shadow-[var(--shadow-sm)]">
        <h1 className="text-xl font-semibold">{i.admin.roles.title}</h1>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="surface rounded-2xl border border-theme p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[var(--surface-3)] p-2 text-[var(--primary)]">
              <ShieldCheck className="size-4" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{i.admin.roles.title}</div>
              <div className="text-2xl font-semibold">{overview.total}</div>
            </div>
          </div>
        </div>
        <div className="surface rounded-2xl border border-theme p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[var(--surface-3)] p-2 text-sky-700">
              <Users className="size-4" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{copy.predefinedRoleHelp}</div>
              <div className="text-2xl font-semibold">{overview.predefined}</div>
            </div>
          </div>
        </div>
        <div className="surface rounded-2xl border border-theme p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[var(--surface-3)] p-2 text-emerald-700">
              <SlidersHorizontal className="size-4" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{copy.customRoleHelp}</div>
              <div className="text-2xl font-semibold">{overview.custom}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="surface rounded-2xl border border-theme p-4">
        <div className="text-sm font-medium">{i.admin.roles.createTitle}</div>
        <div className="mt-1 text-xs text-[var(--text-muted)]">{copy.predefinedRoleHelp}</div>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            className="h-10 flex-1 rounded-md border border-theme bg-transparent px-3 text-sm"
            placeholder={i.admin.roles.createNamePlaceholder}
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
          />
          <input
            className="h-10 flex-1 rounded-md border border-theme bg-transparent px-3 text-sm"
            placeholder={i.admin.roles.createDescPlaceholder}
            value={newRoleDesc}
            onChange={(e) => setNewRoleDesc(e.target.value)}
          />
          <button
            className="btn btn-primary"
            disabled={createRole.isPending}
            onClick={() => {
              const name = newRoleName.trim()
              if (name.length < 2) {
                toast.error(i.admin.common.nameTooShort)
                return
              }
              createRole.mutate({ name, description: newRoleDesc.trim() || null })
              setNewRoleName('')
              setNewRoleDesc('')
            }}
          >
            {i.admin.roles.create}
          </button>
        </div>
      </div>

      <div className="surface rounded-2xl border border-theme p-4">
        {isLoading ? (
          <p className="text-sm text-[var(--text-muted)]">{i.admin.security.loading}</p>
        ) : error ? (
          <p className="text-sm text-red-600">
            {i.admin.common.failedToLoad.replace('{what}', 'roles').replace('{error}', String((error as any)?.message ?? ''))}
          </p>
        ) : (
          <div className="grid gap-2">
            {roles.map((r) => {
              const isOpen = openRoleId === r.id
              const selected = selectedKeysForRole(r)
              const modulesToShow = modules.filter((m) => permsByKey.has(`${m}.view`) || permsByKey.has(`${m}.edit`))
              const viewCount = modulesToShow.filter((m) => selected.has(`${m}.view`)).length
              const editCount = modulesToShow.filter((m) => selected.has(`${m}.edit`)).length
              const isPredefined = predefinedRoleNames.has(r.name.trim().toLowerCase())

              return (
                <div key={r.id} className="rounded-2xl border border-theme bg-[var(--surface)] shadow-[var(--shadow-sm)]">
                  <button
                    className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
                    onClick={() => setOpenRoleId((cur) => (cur === r.id ? null : r.id))}
                    type="button"
                  >
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <span>{r.name}</span>
                        {isPredefined ? (
                          <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                            {copy.defaultBadge}
                          </span>
                        ) : null}
                        {hasPendingChanges(r.id) ? (
                          <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                            {i.admin.roles.pending}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">{r.description || '-'}</div>
                      <div className="mt-1 text-[11px] text-[var(--text-muted)]">
                        {copy.roleSummary(viewCount, editCount)} | {r.isSystem ? copy.systemRoleHelp : isPredefined ? copy.predefinedRoleHelp : copy.customRoleHelp}
                      </div>
                    </div>
                    <div className="text-[var(--text-muted)]">
                      {isOpen ? <ChevronUp className="size-5" /> : <ChevronDown className="size-5" />}
                    </div>
                  </button>

                  {isOpen ? (
                    <div className="border-t border-theme px-4 py-4">
                      <div className="mb-2 text-[11px] text-[var(--text-muted)]">{copy.permissionsLegend}</div>
                      <div className="overflow-x-auto">
                        <div className="min-w-[560px] rounded-xl border border-theme bg-[var(--surface-2)]">
                          <div className="grid grid-cols-[1fr_120px_120px] gap-2 border-b border-theme bg-[var(--surface-3)] p-3 text-xs font-semibold uppercase opacity-80">
                            <div>{i.admin.roles.module}</div>
                            <div className="text-center">{i.admin.roles.view}</div>
                            <div className="text-center">{i.admin.roles.edit}</div>
                          </div>
                          <div className="grid grid-cols-[1fr_120px_120px] gap-2 border-b border-theme px-3 py-2 text-[11px] text-[var(--text-muted)]">
                            <div />
                            <div className="text-center">{copy.viewHelp}</div>
                            <div className="text-center">{copy.editHelp}</div>
                          </div>

                          {modulesToShow.map((m) => {
                            const viewKey = `${m}.view`
                            const editKey = `${m}.edit`
                            const hasView = permsByKey.has(viewKey)
                            const hasEdit = permsByKey.has(editKey)
                            const viewChecked = hasView ? selected.has(viewKey) : false
                            const editChecked = hasEdit ? selected.has(editKey) : false
                            const viewDesc = permsByKey.get(viewKey)?.description
                            const editDesc = permsByKey.get(editKey)?.description

                            return (
                              <div
                                key={m}
                                className="grid grid-cols-[1fr_120px_120px] items-center gap-2 border-b border-theme p-3 last:border-b-0"
                              >
                                <div>
                                  <div className="text-sm font-medium">{moduleLabel(i, m)}</div>
                                  <div className="text-[11px] text-[var(--text-muted)]">{viewDesc || editDesc || copy.moduleNoAccess}</div>
                                </div>
                                <div className="flex justify-center">
                                  <input
                                    type="checkbox"
                                    className="size-4 accent-emerald-600 disabled:opacity-40"
                                    disabled={r.isSystem || !hasView}
                                    checked={viewChecked}
                                    onChange={(e) => setPerm(r.id, viewKey, e.target.checked)}
                                  />
                                </div>
                                <div className="flex justify-center">
                                  <input
                                    type="checkbox"
                                    className="size-4 accent-emerald-600 disabled:opacity-40"
                                    disabled={r.isSystem || !hasEdit}
                                    checked={editChecked}
                                    onChange={(e) => setPerm(r.id, editKey, e.target.checked)}
                                  />
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        <div className="mt-2 text-[11px] text-[var(--text-muted)]">{i.admin.roles.tip}</div>
                      </div>

                      <div className="mt-3 flex justify-end">
                        <button
                          className="btn btn-primary"
                          disabled={savePerms.isPending || r.isSystem}
                          onClick={() => {
                            savePerms.mutate({ roleId: r.id, permissionKeys: [...selected] })
                            setDraft((prev) => ({ ...prev, [r.id]: {} }))
                          }}
                        >
                          {i.admin.roles.savePerms}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
