'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Shield, SlidersHorizontal, Users } from 'lucide-react'

import { t } from '@/app/app/i18n'
import { useSettings } from '@/app/app/settings-context'
import { toast } from '@/app/app/toast'

type AdminUser = {
  id: string
  name: string | null
  email: string | null
  globalRole?: 'USER' | 'SUPERADMIN'
  active: boolean
  sessionMaxAgeSec: number | null
  sessionPolicyVersion: number
  workspaceRole?: 'USER' | 'ADMIN'
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

function displayName(u: AdminUser) {
  return u.name || u.email || u.id
}

function moduleLabel(language: string, moduleKey: string) {
  const map: Record<string, Record<string, string>> = {
    pt: {
      sales: 'Vendas',
      purchases: 'Compras',
      inventory: 'Estoque',
      products: 'Produtos',
      clients: 'Clientes',
      finance: 'Financeiro',
      workflow: 'Workflow',
    },
    es: {
      sales: 'Ventas',
      purchases: 'Compras',
      inventory: 'Inventario',
      products: 'Productos',
      clients: 'Clientes',
      finance: 'Finanzas',
      workflow: 'Workflow',
    },
    en: {
      sales: 'Sales',
      purchases: 'Purchases',
      inventory: 'Inventory',
      products: 'Products',
      clients: 'Clients',
      finance: 'Finance',
      workflow: 'Workflow',
    },
  }

  return map[language]?.[moduleKey] || map.en[moduleKey] || moduleKey
}

function screenCopy(language: string) {
  if (language === 'pt') {
    return {
      tabUsersHint: 'Politicas de sessao e revogacao imediata.',
      tabRolesHint: 'Visao rapida de perfis operacionais do workspace.',
      defaultSession: 'Sessao padrao',
      defaultSessionHelp: 'JWT expira em 4h quando nao ha override por usuario.',
      customPolicies: 'Overrides ativos',
      customPoliciesHelp: 'Usuarios com tempo de sessao proprio.',
      workspaceRoles: 'Roles do workspace',
      workspaceRolesHelp: 'Perfis editaveis para modulos operacionais.',
      userPoliciesTitle: 'Politica de sessao por usuario',
      userPoliciesSubtitle: 'Ajuste excecoes de duracao e revogue sessoes ativas no mesmo passo.',
      sessionCurrent: 'Configuracao atual',
      sessionDefault: 'Padrao (4h)',
      sessionCustom: (hours: string) => `${hours}h configuradas`,
      policyVersion: (version: number) => `Politica v${version}`,
      saveAndKick: 'Salvar e revogar',
      supportOnly: 'A alteracao de sessao global por usuario e restrita ao support/superadmin.',
      noUsers: 'Nenhum usuario encontrado.',
      rolesTitle: 'Perfis operacionais do workspace',
      rolesSubtitle: 'Consulta rapida do que cada role libera. Para manutencao completa, use a tela dedicada.',
      openRolesPage: 'Abrir tela completa de roles',
      roleSummary: (modules: number) => `${modules} modulos com permissao`,
      roleTypeSystem: 'Sistema',
      roleTypeCustom: 'Custom',
      noRoles: 'Nenhuma role cadastrada.',
      savePermissions: 'Salvar permissoes',
      createRole: 'Criar role',
      createRoleHint: 'Use esta area para ajustes pontuais. Presets e organizacao completa ficam na tela de roles.',
      roleNamePlaceholder: 'Ex.: Atendimento',
      roleDescPlaceholder: 'Descricao curta',
      sessionForbidden: 'Somente support/superadmin pode alterar sessao por usuario.',
    }
  }

  if (language === 'es') {
    return {
      tabUsersHint: 'Politicas de sesion y revocacion inmediata.',
      tabRolesHint: 'Vista rapida de perfiles operativos del workspace.',
      defaultSession: 'Sesion por defecto',
      defaultSessionHelp: 'El JWT expira en 4h cuando no hay override por usuario.',
      customPolicies: 'Overrides activos',
      customPoliciesHelp: 'Usuarios con tiempo de sesion propio.',
      workspaceRoles: 'Roles del workspace',
      workspaceRolesHelp: 'Perfiles editables para modulos operativos.',
      userPoliciesTitle: 'Politica de sesion por usuario',
      userPoliciesSubtitle: 'Ajusta excepciones de duracion y revoca sesiones activas en el mismo paso.',
      sessionCurrent: 'Configuracion actual',
      sessionDefault: 'Predeterminado (4h)',
      sessionCustom: (hours: string) => `${hours}h configuradas`,
      policyVersion: (version: number) => `Politica v${version}`,
      saveAndKick: 'Guardar y revocar',
      supportOnly: 'El cambio de sesion por usuario esta restringido a support/superadmin.',
      noUsers: 'No se encontraron usuarios.',
      rolesTitle: 'Perfiles operativos del workspace',
      rolesSubtitle: 'Consulta rapida de lo que libera cada rol. Para mantenimiento completo usa la pantalla dedicada.',
      openRolesPage: 'Abrir pantalla completa de roles',
      roleSummary: (modules: number) => `${modules} modulos con permiso`,
      roleTypeSystem: 'Sistema',
      roleTypeCustom: 'Custom',
      noRoles: 'No hay roles registrados.',
      savePermissions: 'Guardar permisos',
      createRole: 'Crear rol',
      createRoleHint: 'Usa esta area para ajustes puntuales. Presets y organizacion completa estan en la pantalla de roles.',
      roleNamePlaceholder: 'Ej.: Atencion',
      roleDescPlaceholder: 'Descripcion corta',
      sessionForbidden: 'Solo support/superadmin puede cambiar la sesion por usuario.',
    }
  }

  return {
    tabUsersHint: 'Session policies and immediate revocation.',
    tabRolesHint: 'Quick view of workspace operational profiles.',
    defaultSession: 'Default session',
    defaultSessionHelp: 'JWT expires in 4h when there is no per-user override.',
    customPolicies: 'Active overrides',
    customPoliciesHelp: 'Users with a custom session lifetime.',
    workspaceRoles: 'Workspace roles',
    workspaceRolesHelp: 'Editable profiles for operational modules.',
    userPoliciesTitle: 'Per-user session policy',
    userPoliciesSubtitle: 'Adjust duration exceptions and revoke active sessions in one step.',
    sessionCurrent: 'Current setup',
    sessionDefault: 'Default (4h)',
    sessionCustom: (hours: string) => `${hours}h configured`,
    policyVersion: (version: number) => `Policy v${version}`,
    saveAndKick: 'Save and revoke',
    supportOnly: 'Per-user session changes are restricted to support/superadmin.',
    noUsers: 'No users found.',
    rolesTitle: 'Workspace operational roles',
    rolesSubtitle: 'Quickly inspect what each role grants. Use the dedicated screen for full maintenance.',
    openRolesPage: 'Open full roles screen',
    roleSummary: (modules: number) => `${modules} modules with permissions`,
    roleTypeSystem: 'System',
    roleTypeCustom: 'Custom',
    noRoles: 'No roles registered.',
    savePermissions: 'Save permissions',
    createRole: 'Create role',
    createRoleHint: 'Use this area for occasional adjustments. Presets and full organization live on the roles screen.',
    roleNamePlaceholder: 'Ex.: Service desk',
    roleDescPlaceholder: 'Short description',
    sessionForbidden: 'Only support/superadmin can change per-user session duration.',
  }
}

export default function SecurityPanel() {
  const qc = useQueryClient()
  const { language } = useSettings()
  const i = t(language)
  const copy = screenCopy(language)

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
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleDesc, setNewRoleDesc] = useState('')
  const [rolePermDraft, setRolePermDraft] = useState<Record<string, Record<string, boolean>>>({})

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
    onError: (err: any) => {
      const msg = String(err?.message ?? '')
      if (msg.includes('FORBIDDEN')) {
        toast.error(copy.sessionForbidden)
        return
      }
      toast.error(i.admin.common.failedToSave)
    },
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-roles'] })
      setNewRoleName('')
      setNewRoleDesc('')
    },
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

  const userRows = useMemo(() => {
    return users.map((u) => ({
      ...u,
      hoursValue: draftHoursById[u.id] ?? secToHours(u.sessionMaxAgeSec),
    }))
  }, [users, draftHoursById])

  const permsByModule = useMemo(() => {
    const map = new Map<string, Permission[]>()
    for (const p of allPerms) {
      const arr = map.get(p.module) ?? []
      arr.push(p)
      map.set(p.module, arr)
    }
    return [...map.entries()]
  }, [allPerms])

  const overview = useMemo(() => {
    return {
      customPolicies: users.filter((u) => u.sessionMaxAgeSec != null).length,
      roles: roles.length,
    }
  }, [roles.length, users])

  function rolePerms(role: Role) {
    return new Set(role.permissions.map((p) => p.permission.key))
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-theme bg-[var(--surface-2)] px-5 py-5 shadow-[var(--shadow-sm)]">
        <h1 className="text-xl font-semibold">{i.admin.security.title}</h1>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="surface rounded-2xl border border-theme p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[var(--surface-3)] p-2 text-[var(--primary)]">
              <KeyRound className="size-4" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{copy.defaultSession}</div>
              <div className="text-2xl font-semibold">4h</div>
            </div>
          </div>
          <div className="mt-2 text-xs text-[var(--text-muted)]">{copy.defaultSessionHelp}</div>
        </div>
        <div className="surface rounded-2xl border border-theme p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[var(--surface-3)] p-2 text-amber-700">
              <SlidersHorizontal className="size-4" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{copy.customPolicies}</div>
              <div className="text-2xl font-semibold">{overview.customPolicies}</div>
            </div>
          </div>
          <div className="mt-2 text-xs text-[var(--text-muted)]">{copy.customPoliciesHelp}</div>
        </div>
        <div className="surface rounded-2xl border border-theme p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[var(--surface-3)] p-2 text-emerald-700">
              <Shield className="size-4" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{copy.workspaceRoles}</div>
              <div className="text-2xl font-semibold">{overview.roles}</div>
            </div>
          </div>
          <div className="mt-2 text-xs text-[var(--text-muted)]">{copy.workspaceRolesHelp}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-theme bg-[var(--surface-2)] p-2">
        <div className="flex flex-wrap gap-2">
        <button
          className={`btn ${tab === 'users' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('users')}
          type="button"
        >
          <Users className="size-4" />
          {i.admin.security.tabUsers}
        </button>
        <button
          className={`btn ${tab === 'roles' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('roles')}
          type="button"
        >
          <Shield className="size-4" />
          {i.admin.security.tabRoles}
        </button>
        </div>
      </div>

      {tab === 'users' ? (
        <div className="surface rounded-2xl border border-theme p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold">{copy.userPoliciesTitle}</h2>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{copy.userPoliciesSubtitle}</p>
            </div>
            <div className="rounded-xl bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text-muted)]">{copy.tabUsersHint}</div>
          </div>

          <div className="mt-4 rounded-xl border border-dashed border-theme bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text-muted)]">
            {copy.supportOnly}
          </div>

          {usersLoading ? (
            <p className="mt-4 text-sm text-[var(--text-muted)]">{i.admin.security.loading}</p>
          ) : usersError ? (
            <p className="mt-4 text-sm text-red-600">
              {i.admin.security.failedLoadUsers.replace('{error}', String((usersError as any)?.message ?? ''))}
            </p>
          ) : userRows.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-theme px-4 py-8 text-sm text-[var(--text-muted)]">
              {copy.noUsers}
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              {userRows.map((u) => (
                <div key={u.id} className="rounded-2xl border border-theme p-4 shadow-[var(--shadow-sm)]">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold">{displayName(u)}</div>
                        {!u.active ? (
                          <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">
                            {i.admin.common.inactive}
                          </span>
                        ) : null}
                        {u.globalRole === 'SUPERADMIN' ? (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                            SUPPORT
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-xs text-[var(--text-muted)]">
                        {u.email || i.admin.common.noEmailPlaceholder} · {copy.policyVersion(u.sessionPolicyVersion)}
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[minmax(160px,220px)_auto] sm:items-end">
                      <label className="grid gap-1">
                        <span className="text-xs text-[var(--text-muted)]">{i.admin.security.maxAgeHours}</span>
                        <input
                          className="h-10 rounded-md border border-theme bg-transparent px-3 text-sm"
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
                        className="btn btn-primary"
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
                        {copy.saveAndKick}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl bg-[var(--surface-2)] p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                        {copy.sessionCurrent}
                      </div>
                      <div className="mt-1 text-sm font-medium">
                        {u.hoursValue ? copy.sessionCustom(u.hoursValue) : copy.sessionDefault}
                      </div>
                    </div>
                    <div className="rounded-xl bg-[var(--surface-2)] p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Workspace</div>
                      <div className="mt-1 text-sm font-medium">{u.workspaceRole || 'USER'}</div>
                    </div>
                    <div className="rounded-xl bg-[var(--surface-2)] p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Conta</div>
                      <div className="mt-1 text-sm font-medium">{u.globalRole === 'SUPERADMIN' ? 'SUPERADMIN' : 'USER'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="surface rounded-2xl border border-theme p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold">{copy.rolesTitle}</h2>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{copy.rolesSubtitle}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="rounded-xl bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text-muted)]">{copy.tabRolesHint}</div>
              <Link href="/app/admin/roles" className="btn btn-secondary">
                {copy.openRolesPage}
              </Link>
            </div>
          </div>

          {rolesLoading ? (
            <p className="mt-4 text-sm text-[var(--text-muted)]">{i.admin.security.loading}</p>
          ) : rolesError ? (
            <p className="mt-4 text-sm text-red-600">
              {i.admin.security.failedLoadRoles.replace('{error}', String((rolesError as any)?.message ?? ''))}
            </p>
          ) : (
            <div className="mt-4 grid gap-4">
              <div className="rounded-2xl border border-theme bg-[var(--surface-2)] p-4">
                <div className="text-sm font-semibold">{copy.createRole}</div>
                <div className="mt-1 text-xs text-[var(--text-muted)]">{copy.createRoleHint}</div>
                <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <input
                    className="h-10 rounded-md border border-theme bg-transparent px-3 text-sm"
                    placeholder={copy.roleNamePlaceholder}
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                  />
                  <input
                    className="h-10 rounded-md border border-theme bg-transparent px-3 text-sm"
                    placeholder={copy.roleDescPlaceholder}
                    value={newRoleDesc}
                    onChange={(e) => setNewRoleDesc(e.target.value)}
                  />
                  <button
                    className="btn btn-primary"
                    disabled={createRoleMutation.isPending}
                    onClick={() => {
                      const name = newRoleName.trim()
                      if (name.length < 2) {
                        toast.error(i.admin.common.nameTooShort)
                        return
                      }
                      createRoleMutation.mutate({ name, description: newRoleDesc.trim() || null })
                    }}
                  >
                    {i.admin.roles.create}
                  </button>
                </div>
              </div>

              {roles.length === 0 ? (
                <div className="rounded-xl border border-dashed border-theme px-4 py-8 text-sm text-[var(--text-muted)]">
                  {copy.noRoles}
                </div>
              ) : (
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
                      <div key={r.id} className="rounded-2xl border border-theme p-4 shadow-[var(--shadow-sm)]">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-sm font-semibold">{r.name}</div>
                              <span className="rounded-full border border-theme bg-[var(--surface-2)] px-2 py-0.5 text-[11px]">
                                {r.isSystem ? copy.roleTypeSystem : copy.roleTypeCustom}
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-[var(--text-muted)]">{r.description || '-'}</div>
                            <div className="mt-1 text-[11px] text-[var(--text-muted)]">
                              {copy.roleSummary(new Set(Array.from(selected).map((key) => key.split('.')[0])).size)}
                            </div>
                          </div>
                          <button
                            className="btn btn-primary"
                            disabled={updateRolePermsMutation.isPending || r.isSystem}
                            onClick={() => {
                              updateRolePermsMutation.mutate({ roleId: r.id, permissionKeys: [...selected] })
                              setRolePermDraft((prev) => ({ ...prev, [r.id]: {} }))
                            }}
                          >
                            {copy.savePermissions}
                          </button>
                        </div>

                        <div className="mt-4 grid gap-3">
                          {permsByModule.map(([module, perms]) => (
                            <div key={module} className="rounded-xl border border-theme bg-[var(--surface-2)] p-3">
                              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                                {moduleLabel(language, module)}
                              </div>
                              <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                {perms.map((p) => {
                                  const checked = selected.has(p.key)
                                  return (
                                    <label key={p.key} className="flex items-start gap-2 rounded-lg bg-[var(--surface)] p-2 text-sm">
                                      <input
                                        className="mt-0.5 size-4 accent-emerald-600 disabled:opacity-40"
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
                                        <span className="mt-1 block text-xs text-[var(--text-muted)]">{p.description || ''}</span>
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
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
