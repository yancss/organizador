'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  CalendarClock,
  CreditCard,
  PackageCheck,
  RotateCcw,
  ShoppingCart,
  Truck,
  Wallet,
} from 'lucide-react'

import { useSettings } from '../settings-context'
import { t } from '../i18n'
import { api } from '../api-client'

function formatMoney(language: string, currency: string, value: string | number) {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return '-'

  const locale = language === 'pt' ? 'pt-BR' : language === 'es' ? 'es-ES' : 'en-US'

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: 2,
    }).format(n)
  } catch {
    // Fallback (should be rare)
    return n.toFixed(2)
  }
}

// (moved to api-client.ts)


type Tone = 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'slate'

function toneClasses(tone: Tone) {
  // IMPORTANT: we do NOT rely on Tailwind's `dark:` variant here because Tailwind defaults to
  // `prefers-color-scheme` (media). Our app theme is controlled by Settings via CSS variables.
  // So the base surfaces use CSS vars; tone is only an accent (top bar + icon + pill + focus ring).
  switch (tone) {
    case 'green':
      return {
        ring: 'focus-visible:ring-emerald-400/50',
        accent: 'bg-emerald-500/20',
        icon: 'text-emerald-700 bg-[var(--surface)] border-[var(--border)]',
        pill: 'bg-emerald-500/10 text-emerald-800',
      }
    case 'amber':
      return {
        ring: 'focus-visible:ring-amber-400/50',
        accent: 'bg-amber-500/20',
        icon: 'text-amber-800 bg-[var(--surface)] border-[var(--border)]',
        pill: 'bg-amber-500/10 text-amber-900',
      }
    case 'red':
      return {
        ring: 'focus-visible:ring-rose-400/50',
        accent: 'bg-rose-500/20',
        icon: 'text-rose-800 bg-[var(--surface)] border-[var(--border)]',
        pill: 'bg-rose-500/10 text-rose-900',
      }
    case 'purple':
      return {
        ring: 'focus-visible:ring-violet-400/50',
        accent: 'bg-violet-500/20',
        icon: 'text-violet-800 bg-[var(--surface)] border-[var(--border)]',
        pill: 'bg-violet-500/10 text-violet-900',
      }
    case 'slate':
      return {
        ring: 'focus-visible:ring-slate-400/50',
        accent: 'bg-slate-500/15',
        icon: 'text-slate-700 bg-[var(--surface)] border-[var(--border)]',
        pill: 'bg-slate-500/10 text-slate-800',
      }
    case 'blue':
    default:
      return {
        ring: 'focus-visible:ring-sky-400/50',
        accent: 'bg-sky-500/20',
        icon: 'text-sky-800 bg-[var(--surface)] border-[var(--border)]',
        pill: 'bg-sky-500/10 text-sky-900',
      }
  }
}

function Card({
  title,
  value,
  hint,
  href,
  icon,
  tone = 'slate',
}: {
  title: string
  value: string
  hint?: string
  href?: string
  icon?: React.ReactNode
  tone?: Tone
}) {
  const toneC = toneClasses(tone)

  const inner = (
    <div className="group relative overflow-hidden rounded-xl border border-theme bg-gradient-to-br from-[var(--surface)] to-[var(--surface-2)] p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      {/* accent bar (subtle, theme-safe) */}
      <div className={"pointer-events-none absolute inset-x-0 top-0 h-1 " + toneC.accent} />

      {/* subtle highlight */}
      <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
        <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-black/5 blur-2xl" />
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {icon ? (
            <div className={"inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border " + toneC.icon}>
              {icon}
            </div>
          ) : null}
          <div className="min-w-0 truncate text-sm font-medium text-[var(--foreground)]">{title}</div>
        </div>

        {href ? (
          <div className="text-xs text-neutral-400 transition group-hover:text-[var(--foreground)]/70">→</div>
        ) : null}
      </div>

      <div className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
        {value}
      </div>

      {hint ? (
        <div className={"mt-3 inline-flex rounded-full px-2 py-1 text-xs " + toneC.pill}>{hint}</div>
      ) : null}
    </div>
  )

  if (!href) return inner

  return (
    <Link href={href} className={"block focus:outline-none focus-visible:ring-2 " + toneC.ring}>
      {inner}
    </Link>
  )
}

type Summary = {
  cards: {
    receivablesOpen: { count: number; total: string | number }
    receivablesOverdue: { count: number; total: string | number }
    payablesPlanned: { count: number; total: string | number }
    paymentsToday: { count: number; total: string | number }
    salesOrdersOpen: { count: number }
    deliveriesOpen: { count: number }
    deliveriesShippedToday: { count: number }
    refundsPending: { count: number }
  }
}

export default function HomePage() {
  const { language, currency } = useSettings()
  const i = t(language)

  function countLabel(kind: 'title' | 'entry' | 'payment', count: number) {
    if (kind === 'title') return `${count} ${count === 1 ? i.homePage.count.titleOne : i.homePage.count.titleMany}`
    if (kind === 'entry') return `${count} ${count === 1 ? i.homePage.count.entryOne : i.homePage.count.entryMany}`
    return `${count} ${count === 1 ? i.homePage.count.paymentOne : i.homePage.count.paymentMany}`
  }

  const q = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<Summary>('/api/dashboard'),
  })

  const c = q.data?.cards

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{i.home.title}</h1>
        <p className="text-sm text-neutral-600">{i.home.subtitle}</p>
      </div>

      {q.isLoading ? <div>{i.homePage.loading}</div> : null}
      {q.error ? <div>{i.homePage.loadError}</div> : null}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Card
          title={i.home.receivablesOpen}
          value={c ? formatMoney(language, currency, c.receivablesOpen.total) : '-'}
          hint={c ? countLabel('title', c.receivablesOpen.count) : undefined}
          href="/app/finance/receivables"
          icon={<Wallet className="h-4 w-4" />}
          tone="blue"
        />
        <Card
          title={i.home.receivablesOverdue}
          value={c ? formatMoney(language, currency, c.receivablesOverdue.total) : '-'}
          hint={c ? countLabel('title', c.receivablesOverdue.count) : undefined}
          href="/app/finance/receivables"
          icon={<AlertTriangle className="h-4 w-4" />}
          tone="red"
        />
        <Card
          title={i.home.payablesPlanned}
          value={c ? formatMoney(language, currency, c.payablesPlanned.total) : '-'}
          hint={c ? countLabel('entry', c.payablesPlanned.count) : undefined}
          href="/app/finance/payables"
          icon={<CalendarClock className="h-4 w-4" />}
          tone="amber"
        />
        <Card
          title={i.home.paymentsToday}
          value={c ? formatMoney(language, currency, c.paymentsToday.total) : '-'}
          hint={c ? countLabel('payment', c.paymentsToday.count) : undefined}
          href="/app/payments"
          icon={<CreditCard className="h-4 w-4" />}
          tone="green"
        />

        <Card
          title={i.home.salesOrdersOpen}
          value={c ? String(c.salesOrdersOpen.count) : '-'}
          href="/app/sales/orders"
          icon={<ShoppingCart className="h-4 w-4" />}
          tone="purple"
        />
        <Card
          title={i.home.deliveriesOpen}
          value={c ? String(c.deliveriesOpen.count) : '-'}
          href="/app/deliveries"
          icon={<Truck className="h-4 w-4" />}
          tone="blue"
        />
        <Card
          title={i.home.deliveriesShippedToday}
          value={c ? String(c.deliveriesShippedToday.count) : '-'}
          href="/app/deliveries"
          icon={<PackageCheck className="h-4 w-4" />}
          tone="green"
        />
        <Card
          title={i.home.refundsPending}
          value={c ? String(c.refundsPending.count) : '-'}
          href="/app/finance/refunds"
          icon={<RotateCcw className="h-4 w-4" />}
          tone="amber"
        />
      </div>
    </div>
  )
}
