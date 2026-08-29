import Link from 'next/link'

import { requireAdmin } from '@/lib/authz'

import RolesPanel from './roles-panel'

export default async function AdminRolesPage() {
  const auth = await requireAdmin()

  if (!auth.ok) {
    return (
      <div className="rounded-md border p-6">
        <h1 className="text-xl font-semibold">Acesso negado</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Somente administradores podem acessar esta página.</p>
        <Link href="/app" className="btn btn-primary mt-4">
          Voltar
        </Link>
      </div>
    )
  }

  return <RolesPanel />
}
