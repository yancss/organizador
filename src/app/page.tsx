import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-brand text-3xl font-semibold tracking-tight">Guardian</h1>
      <p className="mt-3 text-muted-foreground">
        MVP: tarefas + calendário, com login Google e exportações.
      </p>

      <div className="mt-8 flex gap-3">
        <Link
          href="/app"
          className="rounded-md bg-black px-4 py-2 text-white hover:opacity-90"
        >
          Ir para o app
        </Link>
        <Link
          href="/api/auth/signin?callbackUrl=/app"
          className="rounded-md border px-4 py-2 hover:bg-gray-50"
        >
          Entrar
        </Link>
      </div>

      <p className="mt-10 text-sm text-muted-foreground">
        Obs.: para login funcionar, configure <code>GOOGLE_CLIENT_ID</code>,{' '}
        <code>GOOGLE_CLIENT_SECRET</code> e <code>NEXTAUTH_SECRET</code> no
        arquivo <code>.env</code>.
      </p>
    </main>
  )
}
