'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp } from 'lucide-react'

import { useSettings } from '@/app/app/settings-context'
import { t } from '@/app/app/i18n'

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
  admin: 'admin',
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

export default function RolesPanel() {
  const qc = useQueryClient()
  const { language } = useSettings()
  const i = t(language)

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
    for (const p of allPerms) moduleSet.add(p.module)
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

  // Draft state: roleId -> key -> checked
  const [draft, setDraft] = useState<Record<string, Record<string, boolean>>>({})

  // Single open accordion
  const [openRoleId, setOpenRoleId] = useState<string | null>(null)

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
    // UX rules:
    // - If enabling *.edit, also enable *.view
    // - If disabling *.view, also disable *.edit
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
      <div>
        <h1 className="text-xl font-semibold">{i.admin.roles.title}</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{i.admin.roles.subtitle}</p>
      </div>

      <div className="rounded-xl border p-4">
        <div className="text-sm font-medium">{i.admin.roles.createTitle}</div>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            className="h-9 flex-1 rounded-md border px-2 text-sm"
            placeholder={i.admin.roles.createNamePlaceholder}
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
          />
          <input
            className="h-9 flex-1 rounded-md border px-2 text-sm"
            placeholder={i.admin.roles.createDescPlaceholder}
            value={newRoleDesc}
            onChange={(e) => setNewRoleDesc(e.target.value)}
          />
          <button
            className="h-9 rounded-md bg-black px-3 text-sm text-white disabled:opacity-50"
            disabled={createRole.isPending}
            onClick={() => {
              const name = newRoleName.trim()
              if (name.length < 2) return alert(i.admin.common.nameTooShort)
              createRole.mutate({ name, description: newRoleDesc.trim() || null })
              setNewRoleName('')
              setNewRoleDesc('')
            }}
          >
            {i.admin.roles.create}
          </button>
        </div>
      </div>

      <div className="rounded-xl border p-4">
        {isLoading ? (
          <p className="text-sm text-[var(--text-muted)]">{i.admin.security.loading}</p>
        ) : error ? (
          <p className="text-sm text-red-600">
            {i.admin.common.failedToLoad
              .replace('{what}', 'roles')
              .replace('{error}', String((error as any)?.message ?? ''))}
          </p>
        ) : (
          <div className="grid gap-2">
            {roles.map((r) => {
              const isOpen = openRoleId === r.id
              const selected = selectedKeysForRole(r)
              const modulesToShow = modules.filter((m) => permsByKey.has(`${m}.view`) || permsByKey.has(`${m}.edit`))

              return (
                <div key={r.id} className="rounded-lg border">
                  <button
                    className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
                    onClick={() => setOpenRoleId((cur) => (cur === r.id ? null : r.id))}
                    type="button"
                  >
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <span>{r.name}</span>
                        {hasPendingChanges(r.id) ? (
                          <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                            {i.admin.roles.pending}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {r.description || '—'} {r.isSystem ? `· ${i.admin.common.system}` : ''}
                      </div>
                    </div>
                    <div className="text-[var(--text-muted)]">
                      {isOpen ? <ChevronUp className="size-5" /> : <ChevronDown className="size-5" />}
                    </div>
                  </button>

                  {isOpen ? (
                    <div className="border-t px-3 py-3">
                      <div className="overflow-x-auto">
                        <div className="min-w-[520px] rounded-md border">
                          <div className="grid grid-cols-[1fr_120px_120px] gap-2 border-b bg-[var(--muted)] p-2 text-xs font-semibold uppercase opacity-80">
                            <div>{i.admin.roles.module}</div>
                            <div className="text-center">{i.admin.roles.view}</div>
                            <div className="text-center">{i.admin.roles.edit}</div>
                          </div>

                          {modulesToShow.map((m) => {
                            const viewKey = `${m}.view`
                            const editKey = `${m}.edit`
                            const hasView = permsByKey.has(viewKey)
                            const hasEdit = permsByKey.has(editKey)
                            const viewChecked = hasView ? selected.has(viewKey) : false
                            const editChecked = hasEdit ? selected.has(editKey) : false

                            return (
                              <div
                                key={m}
                                className="grid grid-cols-[1fr_120px_120px] items-center gap-2 border-b p-2 last:border-b-0"
                              >
                                <div className="text-sm">
                                  {m in MODULE_LABEL
                                    ? i.admin.roles.moduleNames[MODULE_LABEL[m as keyof typeof MODULE_LABEL]]
                                  : m}
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

                        <div className="mt-2 text-[11px] text-[var(--text-muted)]">
                          {i.admin.roles.tip}
                        </div>
                      </div>

                      <div className="mt-3 flex justify-end">
                        <button
                          className="h-9 rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
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
