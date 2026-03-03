'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Boxes, BookOpen, CalendarDays, History, Package, Users } from 'lucide-react'

import { useSettings } from './settings-context'
import { t } from './i18n'

function NavItem({
  href,
  label,
  icon: Icon,
}: {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}) {
  const pathname = usePathname()
  const active = pathname === href || (href !== '/app' && pathname.startsWith(href))

  return (
    <Link
      href={href}
      className={
        'flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ' +
        (active
          ? 'bg-[var(--muted)] text-[var(--foreground)]'
          : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]')
      }
    >
      <span className={active ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'}>
        <Icon className="size-5" />
      </span>
      <span className="font-medium">{label}</span>
    </Link>
  )
}

export default function AppSidebar() {
  const { language } = useSettings()
  const i = t(language)

  return (
    <aside className="surface/80 hidden w-64 shrink-0 border-r border-theme backdrop-blur lg:block">
      <div className="flex h-dvh flex-col px-3 py-4">
        <div className="px-2 pb-3">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--primary)] text-[var(--primary-foreground)]">
              <span className="font-brand text-base font-semibold">G</span>
            </div>
            <div>
              <div className="font-brand text-base font-semibold tracking-tight text-[var(--foreground)]">
                Guardian
              </div>
              <div className="text-xs text-[var(--muted-foreground)]">Organizador</div>
            </div>
          </Link>
        </div>

        <nav className="mt-2 grid gap-1">
          <NavItem href="/app" label={i.nav.agenda} icon={CalendarDays} />
          <NavItem
            href="/app/history"
            label={language === 'pt' ? 'Histórico' : language === 'es' ? 'Historial' : 'History'}
            icon={History}
          />
          <NavItem
            href="/app/products"
            label={language === 'pt' ? 'Produtos' : language === 'es' ? 'Productos' : 'Products'}
            icon={Package}
          />
          <NavItem
            href="/app/inventory"
            label={language === 'pt' ? 'Estoque' : language === 'es' ? 'Inventario' : 'Inventory'}
            icon={Boxes}
          />
          <NavItem
            href="/app/clients"
            label={language === 'pt' ? 'Clientes' : language === 'es' ? 'Clientes' : 'Clients'}
            icon={Users}
          />
          <NavItem
            href="/app/recipes"
            label={language === 'pt' ? 'Receitas' : language === 'es' ? 'Recetas' : 'Recipes'}
            icon={BookOpen}
          />
        </nav>

        <div className="mt-auto px-2 pt-4 text-[11px] text-[var(--muted-foreground)]">
          v0.1
        </div>
      </div>
    </aside>
  )
}
