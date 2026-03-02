'use client'

import Link from 'next/link'
import { CalendarDays, History, LogOut, Settings, Package, Users, Boxes, BookOpen } from 'lucide-react'

import { t } from './i18n'
import { useSettings } from './settings-context'

export default function AppHeader() {
  const { language } = useSettings()
  const i = t(language)

  return (
    <header className="border-b border-theme surface/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="font-brand text-lg font-semibold tracking-tight text-[var(--foreground)]"
        >
          Guardian
        </Link>

        <nav className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <Link
            className="grid size-10 place-items-center rounded-lg hover:bg-[var(--muted)]"
            href="/app"
            aria-label={i.nav.agenda}
            title={i.nav.agenda}
          >
            <CalendarDays className="size-5" />
          </Link>

          <Link
            className="grid size-10 place-items-center rounded-lg hover:bg-[var(--muted)]"
            href="/app/history"
            aria-label={language === 'pt' ? 'Histórico' : language === 'es' ? 'Historial' : 'History'}
            title={language === 'pt' ? 'Histórico' : language === 'es' ? 'Historial' : 'History'}
          >
            <History className="size-5" />
          </Link>

          <Link
            className="grid size-10 place-items-center rounded-lg hover:bg-[var(--muted)]"
            href="/app/products"
            aria-label={language === 'pt' ? 'Produtos' : language === 'es' ? 'Productos' : 'Products'}
            title={language === 'pt' ? 'Produtos' : language === 'es' ? 'Productos' : 'Products'}
          >
            <Package className="size-5" />
          </Link>

          <Link
            className="grid size-10 place-items-center rounded-lg hover:bg-[var(--muted)]"
            href="/app/inventory"
            aria-label={language === 'pt' ? 'Estoque' : language === 'es' ? 'Inventario' : 'Inventory'}
            title={language === 'pt' ? 'Estoque' : language === 'es' ? 'Inventario' : 'Inventory'}
          >
            <Boxes className="size-5" />
          </Link>

          <Link
            className="grid size-10 place-items-center rounded-lg hover:bg-[var(--muted)]"
            href="/app/clients"
            aria-label={language === 'pt' ? 'Clientes' : language === 'es' ? 'Clientes' : 'Clients'}
            title={language === 'pt' ? 'Clientes' : language === 'es' ? 'Clientes' : 'Clients'}
          >
            <Users className="size-5" />
          </Link>

          <Link
            className="grid size-10 place-items-center rounded-lg hover:bg-[var(--muted)]"
            href="/app/recipes"
            aria-label={language === 'pt' ? 'Receitas' : language === 'es' ? 'Recetas' : 'Recipes'}
            title={language === 'pt' ? 'Receitas' : language === 'es' ? 'Recetas' : 'Recipes'}
          >
            <BookOpen className="size-5" />
          </Link>
          <Link
            className="grid size-10 place-items-center rounded-lg hover:bg-[var(--muted)]"
            href="/app/settings"
            aria-label={i.nav.settings}
            title={i.nav.settings}
          >
            <Settings className="size-5" />
          </Link>
          <Link
            className="grid size-10 place-items-center rounded-lg hover:bg-[var(--muted)]"
            href="/api/auth/signout"
            aria-label={i.nav.signOut}
            title={i.nav.signOut}
          >
            <LogOut className="size-5" />
          </Link>
        </nav>
      </div>
    </header>
  )
}
