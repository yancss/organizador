import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'

import { authOptions } from '@/lib/auth'

export default async function HomePage() {
  const session = await getServerSession(authOptions)

  // Sem tela intermediária: entra direto no fluxo correto.
  // - logado -> app
  // - deslogado -> login
  redirect(session ? '/app' : '/login')
}
