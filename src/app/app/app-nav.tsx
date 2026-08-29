'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Boxes,
  BookOpen,
  CalendarDays,
  ClipboardList,
  FileText,
  Home as HomeIcon,
  Package,
  Users,
  Wallet,
  Landmark,
  ShoppingCart,
  Shield,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { ROLE_PERMISSION_MODULES } from '@/lib/access-control'

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
        'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors ' +
        (active
          ? 'border border-theme bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--shadow-sm)]'
          : 'text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]')
      }
    >
      <span className={active ? 'text-[color:var(--accent)]' : 'text-[var(--muted-foreground)]'}>
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
    <details className="mb-1 rounded-2xl border border-theme bg-[var(--surface)]/55 p-1" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between select-none rounded-xl px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)] [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <span className="text-[10px] text-[var(--text-muted)]">+</span>
      </summary>
      <div className="mt-2 rounded-xl bg-[var(--surface-2)] px-2 py-2">
        <div className="grid gap-1 border-l border-theme pl-3">{children}</div>
      </div>
    </details>
  )
}

export default function AppNav({ onNavigate }: { onNavigate?: () => void }) {
  const { language } = useSettings()
  const i = t(language)

  const { data: me } = useQuery<{ workspace?: { role?: 'USER' | 'ADMIN'; isSuperadmin?: boolean; permissions?: string[] } }>({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await fetch('/api/me', { cache: 'no-store' })
      if (!res.ok) return {}
      return res.json().catch(() => ({}))
    },
    staleTime: 30_000,
  })

  const canAdmin = Boolean(me?.workspace?.isSuperadmin) || me?.workspace?.role === 'ADMIN'
  const isAdminBypass = Boolean(me?.workspace?.isSuperadmin) || me?.workspace?.role === 'ADMIN'
  const permissionSet = new Set(me?.workspace?.permissions ?? [])
  const canView = (module: (typeof ROLE_PERMISSION_MODULES)[number]) => isAdminBypass || permissionSet.has(`${module}.view`)
  const canViewApprovals = canView('workflow')
  const canViewSales = canView('sales')
  const canViewPurchases = canView('purchases')
  const canViewProducts = canView('products')
  const canViewInventory = canView('inventory')
  const canViewClients = canView('clients')
  const canViewFinance = canView('finance')
  const canViewWorkflow = canView('workflow')
  const canViewCosts = canViewFinance
  const canViewRecipes = canViewProducts
  const showSalesSection = canViewSales || canViewWorkflow
  const showPurchasesSection = canViewPurchases
  const showFinanceSection = canViewFinance
  const showOperations = canViewProducts || canViewInventory || canViewClients || canViewRecipes || canViewCosts
  const hasLoadedPermissions = Boolean(me?.workspace)

  return (
    <nav className="mt-2 rounded-[1.5rem] border border-theme bg-[var(--surface-2)] p-2 shadow-[var(--shadow-sm)]">
      <NavItem href="/app" label={i.nav.home} icon={HomeIcon} onNavigate={onNavigate} />

      {!hasLoadedPermissions || showSalesSection ? (
        <Section title={i.nav.sales} defaultOpen>
          {canViewSales ? (
            <NavItem href="/app/sales/quotes" label={i.nav.salesQuotes} icon={FileText} onNavigate={onNavigate} />
          ) : null}
          {canViewSales ? (
            <NavItem href="/app/sales/orders" label={i.nav.salesOrders} icon={CalendarDays} onNavigate={onNavigate} />
          ) : null}
          {canViewSales ? (
            <NavItem href="/app/deliveries" label={i.nav.deliveries} icon={Package} onNavigate={onNavigate} />
          ) : null}
          {canViewApprovals ? (
            <NavItem href="/app/workflow/approvals" label={i.home.approvalsPending} icon={ClipboardList} onNavigate={onNavigate} />
          ) : null}
        </Section>
      ) : null}

      {!hasLoadedPermissions || showPurchasesSection ? (
        <Section title={i.nav.purchases}>
          {canViewPurchases ? (
            <NavItem
              href="/app/purchases/orders"
              label={i.nav.purchaseOrders}
              icon={ShoppingCart}
              onNavigate={onNavigate}
            />
          ) : null}
        </Section>
      ) : null}
      {!hasLoadedPermissions || showOperations ? (
        <>
          {canViewProducts ? <NavItem href="/app/products" label={i.nav.products} icon={Package} onNavigate={onNavigate} /> : null}
          {canViewInventory ? <NavItem href="/app/inventory" label={i.nav.inventory} icon={Boxes} onNavigate={onNavigate} /> : null}
          {canViewInventory ? (
            <NavItem
              href="/app/inventory/trace"
              label={language === 'pt' ? 'Rastreabilidade' : language === 'es' ? 'Trazabilidad' : 'Traceability'}
              icon={ClipboardList}
              onNavigate={onNavigate}
            />
          ) : null}
          {canViewClients ? <NavItem href="/app/clients" label={i.clients.title} icon={Users} onNavigate={onNavigate} /> : null}
          {canViewRecipes ? <NavItem href="/app/recipes" label={i.nav.recipes} icon={BookOpen} onNavigate={onNavigate} /> : null}
        </>
      ) : null}

      {!hasLoadedPermissions || showFinanceSection ? (
        <Section title={i.nav.finance}>
          {canViewFinance ? <NavItem href="/app/finance" label={i.nav.financeOverview} icon={Wallet} onNavigate={onNavigate} /> : null}
          {canViewFinance ? <NavItem href="/app/finance/receivables" label={i.nav.receivables} icon={Wallet} onNavigate={onNavigate} /> : null}
          {canViewFinance ? <NavItem href="/app/finance/payables" label={i.nav.payables} icon={Wallet} onNavigate={onNavigate} /> : null}
          {canViewFinance ? <NavItem href="/app/finance/refunds" label={i.nav.refunds} icon={Wallet} onNavigate={onNavigate} /> : null}
          {canViewFinance ? <NavItem href="/app/finance/accounts" label={i.nav.accounts} icon={Landmark} onNavigate={onNavigate} /> : null}
          {canViewFinance ? <NavItem href="/app/finance/categories" label={i.nav.categories} icon={Landmark} onNavigate={onNavigate} /> : null}
        </Section>
      ) : null}

      {canViewCosts ? <NavItem href="/app/costs" label={i.nav.costs} icon={Landmark} onNavigate={onNavigate} /> : null}

      {canAdmin ? (
        <Section title={i.nav.admin}>
          <NavItem href="/app/admin/users" label={i.nav.adminUsers} icon={Users} onNavigate={onNavigate} />
          <NavItem href="/app/admin/roles" label={i.nav.adminRolesPermissions} icon={Shield} onNavigate={onNavigate} />
          <NavItem
            href="/app/admin/security"
            label={language === 'pt' ? 'Segurança' : language === 'es' ? 'Seguridad' : 'Security'}
            icon={Shield}
            onNavigate={onNavigate}
          />
          <NavItem href="/app/admin/audit" label={i.nav.adminAudits} icon={ClipboardList} onNavigate={onNavigate} />
          <NavItem
            href="/app/admin/fiscal"
            label={language === 'pt' ? 'Fiscal' : language === 'es' ? 'Fiscal' : 'Fiscal'}
            icon={Landmark}
            onNavigate={onNavigate}
          />
        </Section>
      ) : null}
    </nav>
  )
}
