'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useSettings } from '@/app/app/settings-context'
import { t } from '@/app/app/i18n'
import { toast, toastAlreadyExistsEmail } from '@/app/app/toast'

type AdminUser = {
  id: string
  name: string | null
  email: string | null
  role: 'USER' | 'SUPERADMIN'
  active: boolean
  workspaceRole: 'USER' | 'ADMIN'
  sessionMaxAgeSec: number | null
  sessionPolicyVersion: number
  birthDate: string | null
  createdAt: string
  roleCustom: { id: string; name: string } | null
}

type Role = {
  id: string
  name: string
  description: string | null
  isSystem: boolean
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

function displayName(u: AdminUser) {
  return u.name || u.email || u.id
}

export default function UsersPanel() {
  const qc = useQueryClient()
  const { language } = useSettings()
  const i = t(language)

  const { data: usersData, isLoading, error } = useQuery<{ users: any[] }>({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const res = await fetch('/api/admin/users', { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || 'FAILED_TO_LOAD')
      return json
    },
  })

  const { data: rolesData } = useQuery<{ roles: Role[]; permissions: any[] }>({
    queryKey: ['admin-roles'],
    queryFn: async () => {
      const res = await fetch('/api/admin/roles', { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || 'FAILED_TO_LOAD')
      return json
    },
  })

  const roles = rolesData?.roles ?? []

  const users: AdminUser[] = useMemo(() => {
    const raw = usersData?.users ?? []
    return raw.map((u: any) => ({
      ...u,
      roleCustom: u.role ?? null,
    }))
  }, [usersData])

  const sessionMutation = useMutation({
    mutationFn: async (args: { id: string; sessionMaxAgeSec: number | null }) => {
      const res = await fetch(`/api/admin/users/${args.id}/session-policy`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionMaxAgeSec: args.sessionMaxAgeSec, forceLogout: true }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || 'FAILED_TO_SAVE')
      return json
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const userMutation = useMutation({
    mutationFn: async (args: { userId: string; patch: any }) => {
      const res = await fetch(`/api/admin/users/${args.userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...args.patch, forceLogout: true }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || 'FAILED_TO_SAVE')
      return json
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const setRoleMutation = useMutation({
    mutationFn: async (args: { userId: string; roleId: string | null }) => {
      const res = await fetch(`/api/admin/users/${args.userId}/roles`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleId: args.roleId, forceLogout: true }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || 'FAILED_TO_SAVE')
      return json
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const resetMutation = useMutation({
    mutationFn: async (args: { userId: string }) => {
      const res = await fetch(`/api/admin/users/${args.userId}/password-reset`, {
        method: 'POST',
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || 'FAILED_TO_SEND')
      return json
    },
  })

  const inviteMutation = useMutation({
    mutationFn: async (args: { email: string; role: 'USER' | 'ADMIN' }) => {
      const res = await fetch('/api/admin/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || 'FAILED_TO_SEND')
      return json
    },
  })

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'USER' | 'ADMIN'>('USER')

  const [editingId, setEditingId] = useState<string | null>(null)

  const editingUser = users.find((u) => u.id === editingId) ?? null

  const [editHours, setEditHours] = useState('')
  const [editWorkspaceRole, setEditWorkspaceRole] = useState<'USER' | 'ADMIN'>('USER')
  const [editCustomRoleId, setEditCustomRoleId] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editName, setEditName] = useState('')
  const [editBirthDate, setEditBirthDate] = useState('')

  function openEdit(u: AdminUser) {
    setEditingId(u.id)
    setEditHours(secToHours(u.sessionMaxAgeSec))
    setEditWorkspaceRole(u.workspaceRole)
    setEditCustomRoleId(u.roleCustom?.id ?? '')
    setEditEmail(u.email || '')
    setEditName(u.name || '')
    // HTML input[type=date] expects YYYY-MM-DD
    setEditBirthDate(u.birthDate ? String(u.birthDate).slice(0, 10) : '')
  }

  async function saveEdit() {
    if (!editingUser) return

    const raw = editHours.trim()
    const sessionMaxAgeSec = raw === '' ? null : hoursToSec(raw)
    if (raw !== '' && sessionMaxAgeSec == null) {
      toast.error(i.admin.common.invalidValue)
      return
    }

    // Save changes. We keep it simple: fire sequentially.
    await sessionMutation.mutateAsync({ id: editingUser.id, sessionMaxAgeSec })

    const patch: any = {
      workspaceRole: editWorkspaceRole,
      name: editName.trim() || null,
      birthDate: editBirthDate.trim() || null,
    }

    // Never allow changing the SUPERADMIN's email (support account)
    if (editingUser.role !== 'SUPERADMIN') {
      patch.email = editEmail.trim() || null
    }

    await userMutation.mutateAsync({
      userId: editingUser.id,
      patch,
    })

    await setRoleMutation.mutateAsync({ userId: editingUser.id, roleId: editCustomRoleId ? editCustomRoleId : null })

    setEditingId(null)
  }

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-xl font-semibold">{i.admin.users.title}</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{i.admin.users.subtitle}</p>
      </div>

      <div className="surface rounded-xl border border-theme p-4">
        <div className="text-sm font-semibold">Convidar usuário</div>
        <div className="mt-1 text-xs text-[var(--text-muted)]">
          Envia um e-mail com link para o usuário criar a conta e definir a senha.
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3 sm:items-end">
          <label className="grid gap-1">
            <span className="text-xs text-[var(--text-muted)]">Email</span>
            <input
              className="h-9 rounded-md border border-theme bg-transparent px-2 text-sm"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="novo@empresa.com"
              type="email"
              autoComplete="email"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs text-[var(--text-muted)]">Role no workspace</span>
            <select
              className="h-9 rounded-md border border-theme bg-transparent px-2 text-sm"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as any)}
            >
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </label>

          <button
            className="h-9 rounded-md bg-[var(--primary)] px-3 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50"
            disabled={inviteMutation.isPending || !inviteEmail.trim()}
            onClick={() => {
              inviteMutation
                .mutateAsync({ email: inviteEmail.trim(), role: inviteRole })
                .then(() => {
                  toast.success(language === 'pt' ? 'Convite enviado.' : language === 'es' ? 'Invitación enviada.' : 'Invite sent.')
                  setInviteEmail('')
                  setInviteRole('USER')
                })
                .catch((e) => {
                  const msg = String(e?.message || '')
                  if (msg.includes('USER_ALREADY_EXISTS')) {
                    toastAlreadyExistsEmail(i)
                    return
                  }
                  toast.error(i.admin.common.failedToSave)
                })
            }}
          >
            {inviteMutation.isPending ? 'Enviando…' : 'Enviar convite'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border">
        <div className="grid grid-cols-1 gap-2 border-b p-3 sm:grid-cols-4 sm:items-center">
          <div className="text-xs font-semibold uppercase opacity-70">{i.admin.users.name}</div>
          <div className="text-xs font-semibold uppercase opacity-70">{i.admin.users.email}</div>
          <div className="text-xs font-semibold uppercase opacity-70">{i.admin.users.role}</div>
          <div className="text-xs font-semibold uppercase opacity-70 sm:text-right">{i.admin.users.actions}</div>
        </div>

        {isLoading ? (
          <div className="p-3 text-sm text-[var(--text-muted)]">{i.admin.security.loading}</div>
        ) : error ? (
          <div className="p-3 text-sm text-red-600">
            {i.admin.common.failedToLoad
              .replace('{what}', i.admin.security.tabUsers.toLowerCase())
              .replace('{error}', String((error as any)?.message ?? ''))}
          </div>
        ) : (
          <div className="divide-y">
            {users.map((u) => (
              <div key={u.id} className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-4 sm:items-center">
                <div className="text-sm font-medium">{displayName(u)}</div>
                <div className="text-sm text-[var(--text-muted)]">{u.email || '—'}</div>
                <div className="text-sm">
                  <span className="rounded-md border px-2 py-1 text-xs">{u.roleCustom?.name ?? i.admin.users.noneRole}</span>
                  <span className="ml-2 rounded-md border px-2 py-1 text-xs">ws:{u.workspaceRole}</span>
                  {!u.active ? (
                    <span className="ml-2 rounded-md border px-2 py-1 text-xs">{i.admin.users.inactive}</span>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <button
                    className="h-9 rounded-md border px-3 text-sm disabled:opacity-50"
                    disabled={resetMutation.isPending}
                    onClick={() => {
                      if (!u.email) {
                        toast.error(i.admin.users.noEmail)
                        return
                      }
                      resetMutation.mutate({ userId: u.id })
                    }}
                  >
                    {i.admin.users.resetPassword}
                  </button>

                  <button className="h-9 rounded-md border px-3 text-sm" onClick={() => openEdit(u)}>
                    {i.admin.users.edit}
                  </button>

                  <button
                    className="h-9 rounded-md bg-red-600 px-3 text-sm text-white disabled:opacity-50 hover:bg-red-700"
                    disabled={userMutation.isPending}
                    onClick={() => {
                      const ok = confirm(i.admin.users.deactivateConfirm.replace('{name}', displayName(u)))
                      if (!ok) return
                      userMutation.mutate({ userId: u.id, patch: { active: false } })
                    }}
                  >
                    {i.admin.users.deactivate}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editingUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="surface modal-safe w-full max-w-2xl rounded-xl p-4 shadow">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">{i.admin.users.editUser}</div>
                <div className="text-xs text-[var(--text-muted)]">{displayName(editingUser)}</div>
              </div>
              <button className="h-9 rounded-md border px-3 text-sm" onClick={() => setEditingId(null)}>
                Fechar
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <label className="grid gap-1">
                <span className="text-xs text-[var(--text-muted)]">Nome</span>
                <input
                  className="h-9 rounded-md border px-2 text-sm"
                  placeholder="Nome"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs text-[var(--text-muted)]">Email</span>
                <input
                  className="h-9 rounded-md border px-2 text-sm disabled:opacity-60"
                  placeholder="email@empresa.com"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  type="email"
                  autoComplete="email"
                  disabled={editingUser.role === 'SUPERADMIN'}
                />
                {editingUser.role === 'SUPERADMIN' ? (
                  <span className="text-[11px] text-[var(--text-muted)]">Email do superadmin é fixo (bloqueado).</span>
                ) : null}
              </label>

              <label className="grid gap-1">
                <span className="text-xs text-[var(--text-muted)]">Data de nascimento</span>
                <input
                  className="h-9 rounded-md border px-2 text-sm"
                  value={editBirthDate}
                  onChange={(e) => setEditBirthDate(e.target.value)}
                  type="date"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs text-[var(--text-muted)]">Sessão (horas)</span>
                <input
                  className="h-9 rounded-md border px-2 text-sm"
                  placeholder="4"
                  value={editHours}
                  onChange={(e) => setEditHours(e.target.value)}
                />
                <span className="text-[11px] text-[var(--text-muted)]">{i.admin.users.sessionHoursHelp}</span>
              </label>

              <label className="grid gap-1">
                <span className="text-xs text-[var(--text-muted)]">{i.admin.users.workspaceRole}</span>
                <select
                  className="h-9 rounded-md border px-2 text-sm"
                  value={editWorkspaceRole}
                  onChange={(e) => setEditWorkspaceRole(e.target.value as any)}
                >
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
                <span className="text-[11px] text-[var(--text-muted)]">{i.admin.users.adminBypassHelp}</span>
              </label>

              <label className="grid gap-1">
                <span className="text-xs text-[var(--text-muted)]">Role (custom)</span>
                <select
                  className="h-9 rounded-md border px-2 text-sm"
                  value={editCustomRoleId}
                  onChange={(e) => setEditCustomRoleId(e.target.value)}
                >
                  <option value="">{i.admin.users.noneRole}</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-[var(--text-muted)]">{i.admin.users.oneRoleHelp}</span>
              </label>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                className="h-9 rounded-md border px-3 text-sm disabled:opacity-50"
                disabled={sessionMutation.isPending || userMutation.isPending || setRoleMutation.isPending}
                onClick={() => setEditingId(null)}
              >
                Cancelar
              </button>
              <button
                className="h-9 rounded-md bg-black px-3 text-sm text-white disabled:opacity-50"
                disabled={sessionMutation.isPending || userMutation.isPending || setRoleMutation.isPending}
                onClick={() =>
                  saveEdit().catch((e) => toast.error(String(e?.message || i.admin.common.failedToSave)))
                }
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
