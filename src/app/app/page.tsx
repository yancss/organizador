import { getServerSession } from 'next-auth'
import Link from 'next/link'

import { authOptions } from '@/lib/auth'
import { missingEnvKeys } from '@/lib/env'

import OrderBoard from './order-board'

export default async function AppPage() {
  const missing = missingEnvKeys()
  if (missing.length) {
    return (
      <div className="rounded-md border bg-yellow-50 p-4">
        <h2 className="font-semibold">Configuração pendente</h2>
        <p className="mt-1 text-sm">
          Preencha as variáveis no <code>.env</code> para liberar login e banco:
        </p>
        <ul className="mt-2 list-inside list-disc text-sm">
          {missing.map((k) => (
            <li key={k}>
              <code>{k}</code>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm">
          Depois disso, acesse{' '}
          <Link className="underline" href="/api/auth/signin">
            /api/auth/signin
          </Link>
          .
        </p>
      </div>
    )
  }

  const session = await getServerSession(authOptions)
  if (!session) {
    return (
      <div className="rounded-md border p-6">
        <h1 className="text-xl font-semibold">Entrar</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Use o Google (produção) ou o <strong>login de teste</strong> (dev) para entrar.
        </p>
        <Link
          href="/api/auth/signin?callbackUrl=/app"
          className="mt-4 inline-flex rounded-md bg-black px-4 py-2 text-white hover:opacity-90"
        >
          Escolher método de login
        </Link>
      </div>
    )
  }

  return <OrderBoard view="upcoming" />
}
