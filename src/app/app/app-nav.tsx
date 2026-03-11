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

function Section({
  title,
  children,
  defaultOpen = false,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  return (
    <details className="rounded-xl" open={defaultOpen}>
      <summary className="cursor-pointer select-none rounded-xl px-3 py-2 text-sm font-medium text-[var(--foreground)] opacity-80 hover:bg-[var(--muted)] hover:opacity-100">
        {title}
      </summary>
      <div className="ml-4 mt-1 grid gap-1">{children}</div>
    </details>
  )
}

export default function AppNav({ onNavigate }: { onNavigate?: () => void }) {
  const { language } = useSettings()
  const i = t(language)

  return (
    <nav className="mt-2 grid gap-1">
      <NavItem href="/app" label={i.nav.agenda} icon={CalendarDays} onNavigate={onNavigate} />

      <Section title={language === 'pt' ? 'Vendas' : language === 'es' ? 'Ventas' : 'Sales'} defaultOpen>
        <NavItem
          href="/app"
          label={language === 'pt' ? 'Pedidos de venda' : language === 'es' ? 'Pedidos de venta' : 'Sales orders'}
          icon={CalendarDays}
          onNavigate={onNavigate}
        />
        <NavItem
          href="/app/deliveries"
          label={language === 'pt' ? 'Entregas' : language === 'es' ? 'Entregas' : 'Deliveries'}
          icon={Package}
          onNavigate={onNavigate}
        />
        <NavItem
          href="/app/receivables"
          label={language === 'pt' ? 'Recebíveis' : language === 'es' ? 'Cuentas por cobrar' : 'Receivables'}
          icon={Wallet}
          onNavigate={onNavigate}
        />
        <NavItem
          href="/app/payments"
          label={language === 'pt' ? 'Pagamentos' : language === 'es' ? 'Pagos' : 'Payments'}
          icon={Wallet}
          onNavigate={onNavigate}
        />
        <NavItem
          href="/app/refunds"
          label={language === 'pt' ? 'Devoluções' : language === 'es' ? 'Reembolsos' : 'Refunds'}
          icon={Wallet}
          onNavigate={onNavigate}
        />
      </Section>

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

      <Section title={language === 'pt' ? 'Financeiro' : language === 'es' ? 'Finanzas' : 'Finance'}>
        <NavItem
          href="/app/finance"
          label={language === 'pt' ? 'Visão geral' : language === 'es' ? 'Resumen' : 'Overview'}
          icon={Wallet}
          onNavigate={onNavigate}
        />
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
      </Section>

      <NavItem
        href="/app/costs"
        label={language === 'pt' ? 'Custos' : language === 'es' ? 'Costos' : 'Costs'}
        icon={Landmark}
        onNavigate={onNavigate}
      />
    </nav>
  )
}
