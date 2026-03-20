'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useSettings } from '@/app/app/settings-context'
import { t } from '@/app/app/i18n'
import { toast } from '@/app/app/toast'

type AdminUser = {
  id: string
  name: string | null
  email: string | null
  role: 'USER' | 'SUPERADMIN'
  active: boolean
  sessionMaxAgeSec: number | null
  sessionPolicyVersion: number
  createdAt: string
}

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

function hoursToSec(v: string) {
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return Math.round(n * 60 * 60)
}

function secToHours(sec: number | null) {
  if (sec == null) return ''
  return String(sec / 3600)
}

export default function SecurityPanel() {
  const qc = useQueryClient()
  const { language } = useSettings()
  const i = t(language)

  const { data: usersData, isLoading: usersLoading, error: usersError } = useQuery<{ users: AdminUser[] }>({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const res = await fetch('/api/admin/users', { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || 'FAILED_TO_LOAD')
      return json
    },
  })

  const { data: rolesData, isLoading: rolesLoading, error: rolesError } = useQuery<{
    roles: Role[]
    permissions: Permission[]
  }>({
    queryKey: ['admin-roles'],
    queryFn: async () => {
      const res = await fetch('/api/admin/roles', { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || 'FAILED_TO_LOAD')
      return json
    },
  })

  const users = usersData?.users ?? []
  const roles = rolesData?.roles ?? []
  const allPerms = rolesData?.permissions ?? []

  const [tab, setTab] = useState<'users' | 'roles'>('users')

  const [draftHoursById, setDraftHoursById] = useState<Record<string, string>>({})

  const sessionMutation = useMutation({
    mutationFn: async (args: { id: string; sessionMaxAgeSec: number | null; forceLogout: boolean }) => {
      const res = await fetch(`/api/admin/users/${args.id}/session-policy`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionMaxAgeSec: args.sessionMaxAgeSec, forceLogout: args.forceLogout }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || 'FAILED_TO_SAVE')
      return json as { user: AdminUser }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const createRoleMutation = useMutation({
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

  const updateRolePermsMutation = useMutation({
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

  const rows = useMemo(() => {
    return users.map((u) => {
      const draft = draftHoursById[u.id]
      return {
        ...u,
        hoursValue: draft ?? secToHours(u.sessionMaxAgeSec),
      }
    })
  }, [users, draftHoursById])

  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleDesc, setNewRoleDesc] = useState('')

  // Per-role local checkbox state
  const [rolePermDraft, setRolePermDraft] = useState<Record<string, Record<string, boolean>>>({})

  function rolePerms(role: Role) {
    const selected = new Set(role.permissions.map((p) => p.permission.key))
    return selected
  }

  const permsByModule = useMemo(() => {
    const map = new Map<string, Permission[]>()
    for (const p of allPerms) {
      const arr = map.get(p.module) ?? []
      arr.push(p)
      map.set(p.module, arr)
    }
    return [...map.entries()]
  }, [allPerms])

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-xl font-semibold">{i.admin.security.title}</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{i.admin.security.subtitle}</p>
      </div>

      <div className="flex gap-2">
        <button
          className={
            'h-9 rounded-md border px-3 text-sm ' +
            (tab === 'users' ? 'bg-[var(--muted)]' : 'bg-transparent hover:bg-[var(--muted)]')
          }
          onClick={() => setTab('users')}
        >
          {i.admin.security.tabUsers}
        </button>
        <button
          className={
            'h-9 rounded-md border px-3 text-sm ' +
            (tab === 'roles' ? 'bg-[var(--muted)]' : 'bg-transparent hover:bg-[var(--muted)]')
          }
          onClick={() => setTab('roles')}
        >
          {i.admin.security.tabRoles}
        </button>
      </div>

      {tab === 'users' ? (
        <div className="rounded-xl border p-4">
          <h2 className="font-semibold">{i.admin.security.sessionPerUserTitle}</h2>

          {usersLoading ? (
            <p className="mt-3 text-sm text-[var(--text-muted)]">{i.admin.security.loading}</p>
          ) : usersError ? (
            <p className="mt-3 text-sm text-red-600">
              {i.admin.security.failedLoadUsers.replace('{error}', String((usersError as any)?.message ?? ''))}
            </p>
          ) : (
            <div className="mt-3 grid gap-3">
              {rows.map((u) => (
                <div key={u.id} className="rounded-lg border p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-medium">{u.name || u.email || u.id}</div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {u.email || i.admin.common.noEmailPlaceholder} · {u.role} ·
                        {u.active ? i.admin.common.active : i.admin.common.inactive} · policy v{u.sessionPolicyVersion}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-end gap-2">
                      <label className="grid gap-1">
                        <span className="text-xs text-[var(--text-muted)]">{i.admin.security.maxAgeHours}</span>
                        <input
                          className="h-9 w-32 rounded-md border px-2 text-sm"
                          placeholder={i.admin.security.maxAgePlaceholder}
                          value={u.hoursValue}
                          onChange={(e) =>
                            setDraftHoursById((prev) => ({
                              ...prev,
                              [u.id]: e.target.value,
                            }))
                          }
                        />
                        <span className="text-[11px] text-[var(--text-muted)]">{i.admin.security.maxAgeHelp}</span>
                      </label>

                      <button
                        className="h-9 rounded-md bg-black px-3 text-sm text-white disabled:opacity-50"
                        disabled={sessionMutation.isPending}
                        onClick={() => {
                          const raw = (draftHoursById[u.id] ?? '').trim()
                          const sessionMaxAgeSec = raw === '' ? null : hoursToSec(raw)
                          if (raw !== '' && sessionMaxAgeSec == null) {
                            toast.error(i.admin.common.invalidValue)
                            return
                          }
                          sessionMutation.mutate({ id: u.id, sessionMaxAgeSec, forceLogout: true })
                        }}
                      >
                        {i.admin.security.saveAndKick}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border p-4">
          <h2 className="font-semibold">{i.admin.security.rolesWorkspaceTitle}</h2>

          {rolesLoading ? (
            <p className="mt-3 text-sm text-[var(--text-muted)]">{i.admin.security.loading}</p>
          ) : rolesError ? (
            <p className="mt-3 text-sm text-red-600">
              {i.admin.security.failedLoadRoles.replace('{error}', String((rolesError as any)?.message ?? ''))}
            </p>
          ) : (
            <div className="mt-3 grid gap-4">
              <div className="rounded-lg border p-3">
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
                    disabled={createRoleMutation.isPending}
                    onClick={() => {
                      const name = newRoleName.trim()
                      if (name.length < 2) {
                        toast.error(i.admin.common.nameTooShort)
                        return
                      }
                      createRoleMutation.mutate({ name, description: newRoleDesc.trim() || null })
                      setNewRoleName('')
                      setNewRoleDesc('')
                    }}
                  >
                    {i.admin.roles.create}
                  </button>
                </div>
              </div>

              <div className="grid gap-3">
                {roles.map((r) => {
                  const baseSelected = rolePerms(r)
                  const draft = rolePermDraft[r.id] || {}
                  const selected = new Set<string>([...baseSelected])
                  for (const [k, v] of Object.entries(draft)) {
                    if (v) selected.add(k)
                    else selected.delete(k)
                  }

                  return (
                    <div key={r.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium">{r.name}</div>
                          <div className="text-xs text-[var(--text-muted)]">
                            {r.isSystem ? i.admin.common.system : i.admin.common.custom} · {r.description || '—'}
                          </div>
                        </div>
                        <button
                          className="h-9 rounded-md bg-black px-3 text-sm text-white disabled:opacity-50"
                          disabled={updateRolePermsMutation.isPending || r.isSystem}
                          onClick={() => {
                            updateRolePermsMutation.mutate({ roleId: r.id, permissionKeys: [...selected] })
                            setRolePermDraft((prev) => ({ ...prev, [r.id]: {} }))
                          }}
                        >
                          {i.admin.roles.savePerms}
                        </button>
                      </div>

                      <div className="mt-3 grid gap-3">
                        {permsByModule.map(([module, perms]) => (
                          <div key={module} className="rounded-md border p-2">
                            <div className="text-xs font-semibold uppercase opacity-70">{module}</div>
                            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                              {perms.map((p) => {
                                const checked = selected.has(p.key)
                                return (
                                  <label key={p.key} className="flex items-start gap-2 text-sm">
                                    <input
                                      className="size-4 accent-emerald-600 disabled:opacity-40"
                                      type="checkbox"
                                      checked={checked}
                                      disabled={r.isSystem}
                                      onChange={(e) => {
                                        const v = e.target.checked
                                        setRolePermDraft((prev) => ({
                                          ...prev,
                                          [r.id]: { ...(prev[r.id] || {}), [p.key]: v },
                                        }))
                                      }}
                                    />
                                    <span>
                                      <span className="font-medium">{p.key}</span>
                                      <span className="block text-xs text-[var(--text-muted)]">{p.description || ''}</span>
                                    </span>
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
