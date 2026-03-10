'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Boxes, BookOpen, CalendarDays, History, Package, Users, Wallet, Landmark } from 'lucide-react'

import { useSettings } from './settings-context'
import { t } from './i18n'

function NavItem({
  href,
  label,
  icon: Icon,
  onNavigate,
}: {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const active = pathname === href || (href !== '/app' && pathname.startsWith(href))

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={
        'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ' +
        (active
          ? 'bg-[var(--muted)] text-[var(--foreground)]'
          : 'text-[var(--foreground)] opacity-80 hover:bg-[var(--muted)] hover:opacity-100')
      }
    >
      <span className={active ? 'text-[var(--foreground)]' : 'text-[var(--foreground)] opacity-80'}>
        <Icon className="size-5" />
      </span>
      <span>{label}</span>
    </Link>
  )
}

export default function AppNav({ onNavigate }: { onNavigate?: () => void }) {
  const { language } = useSettings()
  const i = t(language)

  return (
    <nav className="mt-2 grid gap-1">
      <NavItem href="/app" label={i.nav.agenda} icon={CalendarDays} onNavigate={onNavigate} />
      <NavItem
        href="/app/history"
        label={language === 'pt' ? 'Histórico' : language === 'es' ? 'Historial' : 'History'}
        icon={History}
        onNavigate={onNavigate}
      />
      <NavItem
        href="/app/products"
        label={language === 'pt' ? 'Produtos' : language === 'es' ? 'Productos' : 'Products'}
        icon={Package}
        onNavigate={onNavigate}
      />
      <NavItem
        href="/app/inventory"
        label={language === 'pt' ? 'Estoque' : language === 'es' ? 'Inventario' : 'Inventory'}
        icon={Boxes}
        onNavigate={onNavigate}
      />
      <NavItem
        href="/app/clients"
        label={language === 'pt' ? 'Clientes' : language === 'es' ? 'Clientes' : 'Clients'}
        icon={Users}
        onNavigate={onNavigate}
      />
      <NavItem
        href="/app/recipes"
        label={language === 'pt' ? 'Receitas' : language === 'es' ? 'Recetas' : 'Recipes'}
        icon={BookOpen}
        onNavigate={onNavigate}
      />
      <NavItem
        href="/app/finance"
        label={language === 'pt' ? 'Financeiro' : language === 'es' ? 'Finanzas' : 'Finance'}
        icon={Wallet}
        onNavigate={onNavigate}
      />

      {/* Finance subsections */}
      <div className="ml-9 grid gap-1">
        <NavItem
          href="/app/finance/accounts"
          label={language === 'pt' ? 'Contas' : language === 'es' ? 'Cuentas' : 'Accounts'}
          icon={Landmark}
          onNavigate={onNavigate}
        />
        <NavItem
          href="/app/finance/categories"
          label={language === 'pt' ? 'Categorias' : language === 'es' ? 'Categorías' : 'Categories'}
          icon={Landmark}
          onNavigate={onNavigate}
        />
      </div>

      <NavItem
        href="/app/costs"
        label={language === 'pt' ? 'Custos' : language === 'es' ? 'Costos' : 'Costs'}
        icon={Landmark}
        onNavigate={onNavigate}
      />
    </nav>
  )
}
