import { getServerSession } from 'next-auth'
import Link from 'next/link'

import { authOptions } from '@/lib/auth'
import { missingEnvKeys } from '@/lib/env'

import SettingsPanel from './settings-panel'

export default async function SettingsPage() {
  const missing = missingEnvKeys()
  if (missing.length) {
    return (
      <div className="rounded-md border bg-yellow-50 p-4">
        <h2 className="font-semibold">Configuração pendente</h2>
        <p className="mt-1 text-sm">
          Preencha as variáveis no <code>.env</code> para liberar login e banco.
        </p>
      </div>
    )
  }

  const session = await getServerSession(authOptions)

  if (!session) {
    return (
      <div className="rounded-md border p-6">
        <h1 className="text-xl font-semibold">Entrar</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Faça login para acessar as configurações.</p>
        <Link href="/login" className="btn btn-primary mt-4">
          Ir para login
        </Link>
      </div>
    )
  }

  return <SettingsPanel />
}
