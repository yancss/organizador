'use client'

import { useState } from 'react'
import { FileText, ShieldCheck } from 'lucide-react'

import { useSettings } from '../../settings-context'
import ApprovalPolicyCard from './approval-policy-card'
import QuoteSettingsCard from './quote-settings-card'

type TabKey = 'quotes' | 'approvals'

function copy(language: string) {
  if (language === 'pt') {
    return {
      title: 'Configurações do workspace',
      subtitle: 'Regras e parâmetros que valem para todos os usuários deste workspace.',
      quotes: 'Orçamentos',
      approvals: 'Alçadas de aprovação',
      quotesDesc: 'Validade padrão, ciclo de vida e vencimento dos orçamentos.',
      approvalsDesc: 'Limites de compra e de desconto que disparam aprovação.',
    }
  }
  if (language === 'es') {
    return {
      title: 'Configuración del workspace',
      subtitle: 'Reglas y parámetros que aplican a todos los usuarios de este workspace.',
      quotes: 'Presupuestos',
      approvals: 'Umbrales de aprobación',
      quotesDesc: 'Validez por defecto, ciclo de vida y vencimiento de los presupuestos.',
      approvalsDesc: 'Límites de compra y de descuento que disparan aprobación.',
    }
  }
  return {
    title: 'Workspace settings',
    subtitle: 'Rules and parameters that apply to every user of this workspace.',
    quotes: 'Quotes',
    approvals: 'Approval thresholds',
    quotesDesc: 'Default validity, lifecycle and expiry of quotes.',
    approvalsDesc: 'Purchase and discount limits that trigger an approval.',
  }
}

const TABS: Array<{ key: TabKey; icon: typeof FileText }> = [
  { key: 'quotes', icon: FileText },
  { key: 'approvals', icon: ShieldCheck },
]

export default function SettingsHub() {
  const { language } = useSettings()
  const c = copy(language)
  const [tab, setTab] = useState<TabKey>('quotes')

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-theme bg-[var(--surface-2)] px-5 py-5 shadow-[var(--shadow-sm)]">
        <h1 className="text-xl font-semibold">{c.title}</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{c.subtitle}</p>
      </div>

      <div className="rounded-2xl border border-theme bg-[var(--surface-2)] p-2">
        <div className="flex flex-wrap gap-2">
          {TABS.map(({ key, icon: Icon }) => (
            <button
              key={key}
              type="button"
              className={`btn ${tab === key ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTab(key)}
            >
              <Icon className="size-4" />
              {c[key]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-[var(--text-muted)]">{tab === 'quotes' ? c.quotesDesc : c.approvalsDesc}</p>
        {tab === 'quotes' ? <QuoteSettingsCard /> : <ApprovalPolicyCard />}
      </div>
    </div>
  )
}
