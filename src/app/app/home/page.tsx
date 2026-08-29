'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  CalendarClock,
  CreditCard,
  FileText,
  PackageCheck,
  RotateCcw,
  ShoppingCart,
  Truck,
  Wallet,
} from 'lucide-react'

import { api } from '../api-client'
import { t } from '../i18n'
import { useSettings } from '../settings-context'

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
    return n.toFixed(2)
  }
}

type Tone = 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'slate'

function toneClasses(tone: Tone) {
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
    <div className="group relative flex h-full min-h-[156px] flex-col overflow-hidden rounded-xl border border-theme bg-gradient-to-br from-[var(--surface)] to-[var(--surface-2)] p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className={'pointer-events-none absolute inset-x-0 top-0 h-1 ' + toneC.accent} />

      <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
        <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-black/5 blur-2xl" />
      </div>

      <div className="flex min-h-[2.5rem] items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {icon ? (
            <div className={'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ' + toneC.icon}>
              {icon}
            </div>
          ) : null}
          <div className="min-w-0 text-sm font-medium text-[var(--foreground)]">{title}</div>
        </div>

        {href ? (
          <div className="pt-0.5 text-xs text-neutral-400 transition group-hover:text-[var(--foreground)]/70" aria-hidden="true">
            -&gt;
          </div>
        ) : null}
      </div>

      <div className="mt-3 text-2xl font-semibold tracking-tight text-[var(--foreground)]">{value}</div>

      <div className="mt-auto pt-4">
        {hint ? (
          <div className={'inline-flex rounded-full px-2 py-1 text-xs ' + toneC.pill}>{hint}</div>
        ) : (
          <div className="h-[28px]" aria-hidden="true" />
        )}
      </div>
    </div>
  )

  if (!href) return inner

  return (
    <Link href={href} className={'block h-full focus:outline-none focus-visible:ring-2 ' + toneC.ring}>
      {inner}
    </Link>
  )
}

type Summary = {
  visibleCards: CardKey[]
  cards: {
    receivablesOpen: { count: number; total: string | number }
    receivablesOverdue: { count: number; total: string | number }
    payablesCommitted: { count: number; total: string | number }
    paymentsToday: { count: number; total: string | number }
    quotesPending: { count: number }
    salesOrdersInProgress: { count: number }
    approvalsPending: { count: number }
    inventoryCritical: { urgentCount: number; soonCount: number }
    deliveriesOpen: { count: number }
    deliveriesOverdue: { count: number }
    deliveriesShippedToday: { count: number }
    refundsPending: { count: number }
  }
}

type CardKey = keyof Summary['cards']

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
  const visibleCards = q.data?.visibleCards ?? []

  const cards = c
    ? [
        {
          key: 'receivablesOpen' as const,
          title: i.home.receivablesOpen,
          value: formatMoney(language, currency, c.receivablesOpen.total),
          hint: countLabel('title', c.receivablesOpen.count),
          href: '/app/finance/receivables',
          icon: <Wallet className="h-4 w-4" />,
          tone: 'blue' as const,
        },
        {
          key: 'receivablesOverdue' as const,
          title: i.home.receivablesOverdue,
          value: formatMoney(language, currency, c.receivablesOverdue.total),
          hint: countLabel('title', c.receivablesOverdue.count),
          href: '/app/finance/receivables',
          icon: <AlertTriangle className="h-4 w-4" />,
          tone: 'red' as const,
        },
        {
          key: 'payablesCommitted' as const,
          title: i.home.payablesCommitted,
          value: formatMoney(language, currency, c.payablesCommitted.total),
          hint: countLabel('entry', c.payablesCommitted.count),
          href: '/app/finance/payables',
          icon: <CalendarClock className="h-4 w-4" />,
          tone: 'amber' as const,
        },
        {
          key: 'paymentsToday' as const,
          title: i.home.paymentsToday,
          value: formatMoney(language, currency, c.paymentsToday.total),
          hint: countLabel('payment', c.paymentsToday.count),
          href: '/app/payments',
          icon: <CreditCard className="h-4 w-4" />,
          tone: 'green' as const,
        },
        {
          key: 'quotesPending' as const,
          title: i.home.quotesPending,
          value: String(c.quotesPending.count),
          href: '/app/sales/orders',
          icon: <FileText className="h-4 w-4" />,
          tone: 'slate' as const,
        },
        {
          key: 'salesOrdersInProgress' as const,
          title: i.home.salesOrdersInProgress,
          value: String(c.salesOrdersInProgress.count),
          href: '/app/sales/orders',
          icon: <ShoppingCart className="h-4 w-4" />,
          tone: 'purple' as const,
        },
        {
          key: 'approvalsPending' as const,
          title: i.home.approvalsPending,
          value: String(c.approvalsPending.count),
          href: '/app/workflow/approvals',
          icon: <AlertTriangle className="h-4 w-4" />,
          tone: 'amber' as const,
        },
        {
          key: 'inventoryCritical' as const,
          title: i.home.inventoryCritical,
          value: String(c.inventoryCritical.urgentCount),
          hint:
            language === 'pt'
              ? `${c.inventoryCritical.soonCount} em janela`
              : language === 'es'
                ? `${c.inventoryCritical.soonCount} en ventana`
                : `${c.inventoryCritical.soonCount} in window`,
          href: '/app/inventory',
          icon: <AlertTriangle className="h-4 w-4" />,
          tone: 'red' as const,
        },
        {
          key: 'deliveriesOpen' as const,
          title: i.home.deliveriesOpen,
          value: String(c.deliveriesOpen.count),
          href: '/app/deliveries',
          icon: <Truck className="h-4 w-4" />,
          tone: 'blue' as const,
        },
        {
          key: 'deliveriesOverdue' as const,
          title: i.home.deliveriesOverdue,
          value: String(c.deliveriesOverdue.count),
          href: '/app/deliveries',
          icon: <AlertTriangle className="h-4 w-4" />,
          tone: 'red' as const,
        },
        {
          key: 'deliveriesShippedToday' as const,
          title: i.home.deliveriesShippedToday,
          value: String(c.deliveriesShippedToday.count),
          href: '/app/deliveries',
          icon: <PackageCheck className="h-4 w-4" />,
          tone: 'green' as const,
        },
        {
          key: 'refundsPending' as const,
          title: i.home.refundsPending,
          value: String(c.refundsPending.count),
          href: '/app/finance/refunds',
          icon: <RotateCcw className="h-4 w-4" />,
          tone: 'amber' as const,
        },
      ].filter((card) => visibleCards.includes(card.key))
    : []

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-theme bg-[var(--surface-2)] px-4 py-4 shadow-[var(--shadow-sm)]">
        <h1 className="text-xl font-semibold text-[var(--foreground)]">{i.home.title}</h1>
      </div>

      {q.isLoading ? <div>{i.homePage.loading}</div> : null}
      {q.error ? <div>{i.homePage.loadError}</div> : null}

      <div className="grid auto-rows-fr gap-3 md:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ key, ...card }) => (
          <Card key={key} {...card} />
        ))}
      </div>
    </div>
  )
}
