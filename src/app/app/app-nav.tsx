'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Boxes, BookOpen, CalendarDays, Home as HomeIcon, Package, Users, Wallet, Landmark, ShoppingCart, Shield } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

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

  const { data: me } = useQuery<{ workspace?: { role?: 'USER' | 'ADMIN'; isSuperadmin?: boolean } }>({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await fetch('/api/me', { cache: 'no-store' })
      if (!res.ok) return {}
      return res.json().catch(() => ({}))
    },
    staleTime: 30_000,
  })

  const canAdmin = Boolean(me?.workspace?.isSuperadmin) || me?.workspace?.role === 'ADMIN'

  return (
    <nav className="mt-2 grid gap-1">
      <NavItem href="/app" label={i.nav.home} icon={HomeIcon} onNavigate={onNavigate} />

      <Section title={i.nav.sales} defaultOpen>
        <NavItem href="/app/sales/orders" label={i.nav.salesOrders} icon={CalendarDays} onNavigate={onNavigate} />
        <NavItem href="/app/deliveries" label={i.nav.deliveries} icon={Package} onNavigate={onNavigate} />
      </Section>

      <Section title={i.nav.purchases}>
        <NavItem
          href="/app/purchases/orders"
          label={i.nav.purchaseOrders}
          icon={ShoppingCart}
          onNavigate={onNavigate}
        />
      </Section>
      <NavItem href="/app/products" label={i.nav.products} icon={Package} onNavigate={onNavigate} />
      <NavItem href="/app/inventory" label={i.nav.inventory} icon={Boxes} onNavigate={onNavigate} />
      <NavItem href="/app/clients" label={i.clients.title} icon={Users} onNavigate={onNavigate} />
      <NavItem href="/app/recipes" label={i.nav.recipes} icon={BookOpen} onNavigate={onNavigate} />

      <Section title={i.nav.finance}>
        <NavItem href="/app/finance" label={i.nav.financeOverview} icon={Wallet} onNavigate={onNavigate} />
        <NavItem href="/app/finance/receivables" label={i.nav.receivables} icon={Wallet} onNavigate={onNavigate} />
        <NavItem href="/app/finance/payables" label={i.nav.payables} icon={Wallet} onNavigate={onNavigate} />
        <NavItem href="/app/finance/refunds" label={i.nav.refunds} icon={Wallet} onNavigate={onNavigate} />
        <NavItem href="/app/finance/accounts" label={i.nav.accounts} icon={Landmark} onNavigate={onNavigate} />
        <NavItem href="/app/finance/categories" label={i.nav.categories} icon={Landmark} onNavigate={onNavigate} />
      </Section>

      <NavItem href="/app/costs" label={i.nav.costs} icon={Landmark} onNavigate={onNavigate} />

      {canAdmin ? (
        <Section title={i.nav.admin}>
          <NavItem href="/app/admin/users" label={i.nav.adminUsers} icon={Users} onNavigate={onNavigate} />
          <NavItem href="/app/admin/roles" label={i.nav.adminRolesPermissions} icon={Shield} onNavigate={onNavigate} />
        </Section>
      ) : null}
    </nav>
  )
}
