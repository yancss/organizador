'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Mail, Search, Shield, UserCog, Users } from 'lucide-react'

import { t } from '@/app/app/i18n'
import { useSettings } from '@/app/app/settings-context'
import { toast, toastAlreadyExistsEmail } from '@/app/app/toast'

type AdminUser = {
  id: string
  name: string | null
  email: string | null
  globalRole: 'USER' | 'SUPERADMIN'
  active: boolean
  workspaceRole: 'USER' | 'ADMIN'
  birthDate: string | null
  createdAt: string
  customRole: { id: string; name: string } | null
}

type Role = {
  id: string
  name: string
  description: string | null
  isSystem: boolean
}

function displayName(u: AdminUser) {
  return u.name || u.email || u.id
}

function formatDate(value: string | null, language: string) {
  if (!value) return '-'
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return '-'
  return new Intl.DateTimeFormat(language === 'pt' ? 'pt-BR' : language === 'es' ? 'es-ES' : 'en-US', {
    dateStyle: 'medium',
  }).format(dt)
}

function panelCopy(language: string) {
  if (language === 'pt') {
    return {
      inviteTitle: 'Convidar usuario',
      inviteSubtitle: 'Envia um link para ativacao da conta no workspace atual.',
      inviteRole: 'Acesso inicial no workspace',
      inviteHelp: 'O perfil customizado pode ser atribuido depois, na edicao do usuario.',
      invitePlaceholder: 'novo@empresa.com',
      sendInvite: 'Enviar convite',
      sendingInvite: 'Enviando...',
      inviteSent: 'Convite enviado.',
      searchPlaceholder: 'Buscar por nome, email ou role...',
      cardUsers: 'Usuarios',
      cardAdmins: 'Admins',
      cardCustomRoles: 'Com role custom',
      cardInactive: 'Inativos',
      sectionTitle: 'Base de usuarios',
      sectionSubtitle: 'Gestao rapida de conta, acesso e recuperacao.',
      noResults: 'Nenhum usuario encontrado para o filtro atual.',
      createdAt: 'Criado em',
      birthDate: 'Nascimento',
      workspaceAccess: 'Acesso do workspace',
      customProfile: 'Perfil operacional',
      superadmin: 'Support / superadmin',
      workspaceAdmin: 'Admin do workspace',
      inactive: 'Inativo',
      active: 'Ativo',
      noCustomRole: 'Sem role custom',
      editAccess: 'Editar acesso',
      editUserData: 'Editar usuario',
      userDataSubtitle: 'Dados basicos da conta e bloqueios sensiveis.',
      accessSubtitle: 'Nivel administrativo do workspace e role operacional.',
      close: 'Fechar',
      save: 'Salvar',
      cancel: 'Cancelar',
      name: 'Nome',
      email: 'Email',
      customRole: 'Role custom',
      supportLocked: 'O email da conta support/superadmin permanece bloqueado.',
      accountStatus: 'Status da conta',
      deactivateWarning: 'Desativar remove o acesso imediato ate reativacao.',
      resetSent: 'Email de redefinicao enviado.',
      resetFailedNoEmail: 'Usuario sem email cadastrado.',
    }
  }

  if (language === 'es') {
    return {
      inviteTitle: 'Invitar usuario',
      inviteSubtitle: 'Envia un enlace para activar la cuenta en el workspace actual.',
      inviteRole: 'Acceso inicial del workspace',
      inviteHelp: 'El rol operativo se puede asignar despues, al editar el usuario.',
      invitePlaceholder: 'nuevo@empresa.com',
      sendInvite: 'Enviar invitacion',
      sendingInvite: 'Enviando...',
      inviteSent: 'Invitacion enviada.',
      searchPlaceholder: 'Buscar por nombre, correo o rol...',
      cardUsers: 'Usuarios',
      cardAdmins: 'Admins',
      cardCustomRoles: 'Con rol custom',
      cardInactive: 'Inactivos',
      sectionTitle: 'Base de usuarios',
      sectionSubtitle: 'Gestion rapida de cuenta, acceso y recuperacion.',
      noResults: 'No se encontraron usuarios para el filtro actual.',
      createdAt: 'Creado el',
      birthDate: 'Nacimiento',
      workspaceAccess: 'Acceso del workspace',
      customProfile: 'Perfil operativo',
      superadmin: 'Support / superadmin',
      workspaceAdmin: 'Admin del workspace',
      inactive: 'Inactivo',
      active: 'Activo',
      noCustomRole: 'Sin rol custom',
      editAccess: 'Editar acceso',
      editUserData: 'Editar usuario',
      userDataSubtitle: 'Datos basicos de la cuenta y bloqueos sensibles.',
      accessSubtitle: 'Nivel administrativo del workspace y rol operativo.',
      close: 'Cerrar',
      save: 'Guardar',
      cancel: 'Cancelar',
      name: 'Nombre',
      email: 'Correo',
      customRole: 'Rol custom',
      supportLocked: 'El email de support/superadmin permanece bloqueado.',
      accountStatus: 'Estado de la cuenta',
      deactivateWarning: 'Desactivar corta el acceso de inmediato hasta reactivacion.',
      resetSent: 'Correo de restablecimiento enviado.',
      resetFailedNoEmail: 'Usuario sin correo registrado.',
    }
  }

  return {
    inviteTitle: 'Invite user',
    inviteSubtitle: 'Sends an activation link for the current workspace.',
    inviteRole: 'Initial workspace access',
    inviteHelp: 'The operational role can be assigned later from the user editor.',
    invitePlaceholder: 'new@company.com',
    sendInvite: 'Send invite',
    sendingInvite: 'Sending...',
    inviteSent: 'Invite sent.',
    searchPlaceholder: 'Search by name, email, or role...',
    cardUsers: 'Users',
    cardAdmins: 'Admins',
    cardCustomRoles: 'With custom role',
    cardInactive: 'Inactive',
    sectionTitle: 'User directory',
    sectionSubtitle: 'Fast account, access, and recovery management.',
    noResults: 'No users match the current filter.',
    createdAt: 'Created on',
    birthDate: 'Birth date',
    workspaceAccess: 'Workspace access',
    customProfile: 'Operational profile',
    superadmin: 'Support / superadmin',
    workspaceAdmin: 'Workspace admin',
    inactive: 'Inactive',
    active: 'Active',
    noCustomRole: 'No custom role',
    editAccess: 'Edit access',
    editUserData: 'Edit user',
    userDataSubtitle: 'Core account data and sensitive locks.',
    accessSubtitle: 'Workspace admin level and operational role.',
    close: 'Close',
    save: 'Save',
    cancel: 'Cancel',
    name: 'Name',
    email: 'Email',
    customRole: 'Custom role',
    supportLocked: 'The support/superadmin account email stays locked.',
    accountStatus: 'Account status',
    deactivateWarning: 'Deactivation cuts access immediately until re-enabled.',
    resetSent: 'Password reset email sent.',
    resetFailedNoEmail: 'User has no registered email.',
  }
}

function badgeTone(kind: 'neutral' | 'success' | 'warning' | 'danger') {
  if (kind === 'success') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (kind === 'warning') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (kind === 'danger') return 'border-rose-200 bg-rose-50 text-rose-700'
  return 'border-theme bg-[var(--surface-2)] text-[var(--foreground)]'
}

export default function UsersPanel() {
  const qc = useQueryClient()
  const { language } = useSettings()
  const i = t(language)
  const copy = panelCopy(language)

  const { data: usersData, isLoading, error } = useQuery<{ users: AdminUser[] }>({
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
  const users = usersData?.users ?? []

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
      const res = await fetch(`/api/admin/users/${args.userId}/password-reset`, { method: 'POST' })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || 'FAILED_TO_SEND')
      return json
    },
    onSuccess: () => toast.success(copy.resetSent),
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
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  const editingUser = users.find((u) => u.id === editingId) ?? null

  const [editWorkspaceRole, setEditWorkspaceRole] = useState<'USER' | 'ADMIN'>('USER')
  const [editCustomRoleId, setEditCustomRoleId] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editName, setEditName] = useState('')
  const [editBirthDate, setEditBirthDate] = useState('')

  const filteredUsers = (() => {
    const term = query.trim().toLowerCase()
    if (!term) return users

    return users.filter((u) => {
      const haystack = [displayName(u), u.email || '', u.customRole?.name || '', u.workspaceRole, u.globalRole]
        .join(' ')
        .toLowerCase()

      return haystack.includes(term)
    })
  })()

  const stats = {
    total: users.length,
    admins: users.filter((u) => u.workspaceRole === 'ADMIN' || u.globalRole === 'SUPERADMIN').length,
    customRoles: users.filter((u) => Boolean(u.customRole)).length,
    inactive: users.filter((u) => !u.active).length,
  }

  function openEdit(u: AdminUser) {
    setEditingId(u.id)
    setEditWorkspaceRole(u.workspaceRole)
    setEditCustomRoleId(u.customRole?.id ?? '')
    setEditEmail(u.email || '')
    setEditName(u.name || '')
    setEditBirthDate(u.birthDate ? String(u.birthDate).slice(0, 10) : '')
  }

  async function saveEdit() {
    if (!editingUser) return

    const patch: any = {
      workspaceRole: editWorkspaceRole,
      name: editName.trim() || null,
      birthDate: editBirthDate.trim() || null,
    }

    if (editingUser.globalRole !== 'SUPERADMIN') {
      patch.email = editEmail.trim() || null
    }

    await userMutation.mutateAsync({ userId: editingUser.id, patch })
    await setRoleMutation.mutateAsync({ userId: editingUser.id, roleId: editCustomRoleId || null })

    setEditingId(null)
  }

  const saveBusy = userMutation.isPending || setRoleMutation.isPending

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-theme bg-[var(--surface-2)] px-5 py-5 shadow-[var(--shadow-sm)]">
        <h1 className="text-xl font-semibold">{i.admin.users.title}</h1>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="surface rounded-2xl border border-theme p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[var(--surface-3)] p-2 text-[var(--primary)]">
              <Users className="size-4" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{copy.cardUsers}</div>
              <div className="text-2xl font-semibold">{stats.total}</div>
            </div>
          </div>
        </div>
        <div className="surface rounded-2xl border border-theme p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[var(--surface-3)] p-2 text-amber-700">
              <Shield className="size-4" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{copy.cardAdmins}</div>
              <div className="text-2xl font-semibold">{stats.admins}</div>
            </div>
          </div>
        </div>
        <div className="surface rounded-2xl border border-theme p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[var(--surface-3)] p-2 text-emerald-700">
              <UserCog className="size-4" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{copy.cardCustomRoles}</div>
              <div className="text-2xl font-semibold">{stats.customRoles}</div>
            </div>
          </div>
        </div>
        <div className="surface rounded-2xl border border-theme p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[var(--surface-3)] p-2 text-rose-700">
              <KeyRound className="size-4" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{copy.cardInactive}</div>
              <div className="text-2xl font-semibold">{stats.inactive}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
        <div className="surface rounded-2xl border border-theme p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">{copy.sectionTitle}</div>
              <div className="mt-1 text-xs text-[var(--text-muted)]">{copy.sectionSubtitle}</div>
            </div>
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                className="h-10 w-full rounded-md border border-theme bg-transparent pl-9 pr-3 text-sm"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={copy.searchPlaceholder}
              />
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            {isLoading ? (
              <div className="rounded-xl border border-dashed border-theme px-4 py-8 text-sm text-[var(--text-muted)]">
                {i.admin.security.loading}
              </div>
            ) : error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-8 text-sm text-rose-700">
                {i.admin.common.failedToLoad
                  .replace('{what}', i.admin.security.tabUsers.toLowerCase())
                  .replace('{error}', String((error as any)?.message ?? ''))}
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-theme px-4 py-8 text-sm text-[var(--text-muted)]">
                {copy.noResults}
              </div>
            ) : (
              filteredUsers.map((u) => (
                <div key={u.id} className="rounded-2xl border border-theme bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-sm font-semibold">{displayName(u)}</div>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${badgeTone(
                            u.active ? 'success' : 'danger',
                          )}`}
                        >
                          {u.active ? copy.active : copy.inactive}
                        </span>
                        {u.globalRole === 'SUPERADMIN' ? (
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${badgeTone('warning')}`}>
                            {copy.superadmin}
                          </span>
                        ) : null}
                        {u.workspaceRole === 'ADMIN' ? (
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${badgeTone('neutral')}`}>
                            {copy.workspaceAdmin}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
                        <span>{u.email || i.admin.common.noEmailPlaceholder}</span>
                        <span>{copy.createdAt}: {formatDate(u.createdAt, language)}</span>
                        <span>{copy.birthDate}: {formatDate(u.birthDate, language)}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <button
                        className="btn btn-secondary"
                        disabled={resetMutation.isPending}
                        onClick={() => {
                          if (!u.email) {
                            toast.error(copy.resetFailedNoEmail)
                            return
                          }
                          resetMutation.mutate({ userId: u.id })
                        }}
                      >
                        {i.admin.users.resetPassword}
                      </button>
                      <button className="btn btn-secondary" onClick={() => openEdit(u)}>
                        {copy.editAccess}
                      </button>
                      <button
                        className="btn btn-danger"
                        disabled={userMutation.isPending || !u.active}
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

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl bg-[var(--surface-2)] p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                        {copy.workspaceAccess}
                      </div>
                      <div className="mt-1 text-sm font-medium">{u.workspaceRole}</div>
                      <div className="mt-1 text-xs text-[var(--text-muted)]">
                        {u.globalRole === 'SUPERADMIN' ? copy.superadmin : u.workspaceRole === 'ADMIN' ? copy.workspaceAdmin : '-'}
                      </div>
                    </div>
                    <div className="rounded-xl bg-[var(--surface-2)] p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                        {copy.customProfile}
                      </div>
                      <div className="mt-1 text-sm font-medium">{u.customRole?.name || copy.noCustomRole}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="surface rounded-2xl border border-theme p-4">
          <div className="rounded-2xl bg-[var(--surface-2)] px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
              Onboarding
            </div>
            <div className="mt-2 text-sm font-semibold">{copy.inviteTitle}</div>
            <div className="mt-1 text-xs text-[var(--text-muted)]">{copy.inviteSubtitle}</div>
          </div>

          <div className="mt-4 grid gap-3">
            <label className="grid gap-1">
              <span className="text-xs text-[var(--text-muted)]">{copy.email}</span>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  className="h-10 w-full rounded-md border border-theme bg-transparent pl-9 pr-3 text-sm"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder={copy.invitePlaceholder}
                  type="email"
                  autoComplete="email"
                />
              </div>
            </label>

            <label className="grid gap-1">
              <span className="text-xs text-[var(--text-muted)]">{copy.inviteRole}</span>
              <select
                className="h-10 rounded-md border border-theme bg-transparent px-3 text-sm"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'USER' | 'ADMIN')}
              >
                <option value="USER">USER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </label>

            <div className="rounded-xl bg-[var(--surface-2)] p-3 text-xs text-[var(--text-muted)]">{copy.inviteHelp}</div>

            <button
              className="btn btn-primary"
              disabled={inviteMutation.isPending || !inviteEmail.trim()}
              onClick={() => {
                inviteMutation
                  .mutateAsync({ email: inviteEmail.trim(), role: inviteRole })
                  .then(() => {
                    toast.success(copy.inviteSent)
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
              {inviteMutation.isPending ? copy.sendingInvite : copy.sendInvite}
            </button>
          </div>
        </div>
      </div>

      {editingUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="surface modal-safe w-full max-w-3xl rounded-2xl border border-theme p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-base font-semibold">{copy.editUserData}</div>
                <div className="mt-1 text-sm text-[var(--text-muted)]">{displayName(editingUser)}</div>
              </div>
              <button className="btn btn-secondary" onClick={() => setEditingId(null)}>
                {copy.close}
              </button>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-theme p-4">
                <div className="text-sm font-semibold">{copy.editUserData}</div>
                <div className="mt-1 text-xs text-[var(--text-muted)]">{copy.userDataSubtitle}</div>

                <div className="mt-4 grid gap-3">
                  <label className="grid gap-1">
                    <span className="text-xs text-[var(--text-muted)]">{copy.name}</span>
                    <input
                      className="h-10 rounded-md border border-theme bg-transparent px-3 text-sm"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder={copy.name}
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs text-[var(--text-muted)]">{copy.email}</span>
                    <input
                      className="h-10 rounded-md border border-theme bg-transparent px-3 text-sm disabled:opacity-60"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      type="email"
                      autoComplete="email"
                      disabled={editingUser.globalRole === 'SUPERADMIN'}
                      placeholder={copy.email}
                    />
                    {editingUser.globalRole === 'SUPERADMIN' ? (
                      <span className="text-[11px] text-[var(--text-muted)]">{copy.supportLocked}</span>
                    ) : null}
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs text-[var(--text-muted)]">{copy.birthDate}</span>
                    <input
                      className="h-10 rounded-md border border-theme bg-transparent px-3 text-sm"
                      value={editBirthDate}
                      onChange={(e) => setEditBirthDate(e.target.value)}
                      type="date"
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-xl border border-theme p-4">
                <div className="text-sm font-semibold">{copy.workspaceAccess}</div>
                <div className="mt-1 text-xs text-[var(--text-muted)]">{copy.accessSubtitle}</div>

                <div className="mt-4 grid gap-3">
                  <label className="grid gap-1">
                    <span className="text-xs text-[var(--text-muted)]">{i.admin.users.workspaceRole}</span>
                    <select
                      className="h-10 rounded-md border border-theme bg-transparent px-3 text-sm"
                      value={editWorkspaceRole}
                      onChange={(e) => setEditWorkspaceRole(e.target.value as 'USER' | 'ADMIN')}
                    >
                      <option value="USER">USER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                    <span className="text-[11px] text-[var(--text-muted)]">{i.admin.users.adminBypassHelp}</span>
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs text-[var(--text-muted)]">{copy.customRole}</span>
                    <select
                      className="h-10 rounded-md border border-theme bg-transparent px-3 text-sm"
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

                  <div className="rounded-lg bg-[var(--surface-2)] p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                      {copy.accountStatus}
                    </div>
                    <div className="mt-1 text-sm font-medium">{editingUser.active ? copy.active : copy.inactive}</div>
                    <div className="mt-1 text-[11px] text-[var(--text-muted)]">{copy.deactivateWarning}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                className="btn btn-secondary"
                disabled={saveBusy}
                onClick={() => setEditingId(null)}
              >
                {copy.cancel}
              </button>
              <button
                className="btn btn-primary"
                disabled={saveBusy}
                onClick={() => saveEdit().catch((e) => toast.error(String(e?.message || i.admin.common.failedToSave)))}
              >
                {copy.save}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
