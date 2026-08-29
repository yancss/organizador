'use client'

import { useState } from 'react'
import { FileText, ShieldCheck, ListPlus } from 'lucide-react'

import { useSettings } from '../../settings-context'
import ApprovalPolicyCard from './approval-policy-card'
import QuoteSettingsCard from './quote-settings-card'
import CustomFieldsPanel from './custom-fields-panel'

type TabKey = 'quotes' | 'approvals' | 'fields'

function copy(language: string) {
  if (language === 'pt') {
    return {
      title: 'Configurações do workspace',
      subtitle: 'Regras e parâmetros que valem para todos os usuários deste workspace.',
      quotes: 'Orçamentos',
      approvals: 'Alçadas de aprovação',
      fields: 'Campos personalizados',
      quotesDesc: 'Validade padrão, ciclo de vida e vencimento dos orçamentos.',
      approvalsDesc: 'Limites de compra e de desconto que disparam aprovação.',
      fieldsDesc: 'Campos extras nos objetos do sistema.',
    }
  }
  if (language === 'es') {
    return {
      title: 'Configuración del workspace',
      subtitle: 'Reglas y parámetros que aplican a todos los usuarios de este workspace.',
      quotes: 'Presupuestos',
      approvals: 'Umbrales de aprobación',
      fields: 'Campos personalizados',
      quotesDesc: 'Validez por defecto, ciclo de vida y vencimiento de los presupuestos.',
      approvalsDesc: 'Límites de compra y de descuento que disparan aprobación.',
      fieldsDesc: 'Campos extra en los objetos del sistema.',
    }
  }
  return {
    title: 'Workspace settings',
    subtitle: 'Rules and parameters that apply to every user of this workspace.',
    quotes: 'Quotes',
    approvals: 'Approval thresholds',
    fields: 'Custom fields',
    quotesDesc: 'Default validity, lifecycle and expiry of quotes.',
    approvalsDesc: 'Purchase and discount limits that trigger an approval.',
    fieldsDesc: 'Extra fields on system objects.',
  }
}

const TABS: Array<{ key: TabKey; icon: typeof FileText }> = [
  { key: 'quotes', icon: FileText },
  { key: 'approvals', icon: ShieldCheck },
  { key: 'fields', icon: ListPlus },
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
        <p className="text-xs text-[var(--text-muted)]">
          {tab === 'quotes' ? c.quotesDesc : tab === 'approvals' ? c.approvalsDesc : c.fieldsDesc}
        </p>
        {tab === 'quotes' ? <QuoteSettingsCard /> : tab === 'approvals' ? <ApprovalPolicyCard /> : <CustomFieldsPanel />}
      </div>
    </div>
  )
}
