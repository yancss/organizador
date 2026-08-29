'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '../../api-client'
import { useSettings } from '../../settings-context'
import { toast } from '../../toast'

type Settings = {
  defaultValidityDays: number
  allowApproveFromDraft: boolean
  convertedOrderStatus: 'DRAFT' | 'CONFIRMED'
  autoExpire: boolean
  reminderDaysBefore: number
}
type Resp = { settings: Settings; defaults: Settings; isCustom: boolean }

function copy(language: string) {
  if (language === 'pt') {
    return {
      title: 'Configuração de orçamentos',
      validity: 'Validade padrão (dias)',
      validityHint: '0 = sem validade automática',
      approveFromDraft: 'Permitir aprovar direto do rascunho (pular "Enviado")',
      convertStatus: 'Status do pedido gerado na conversão',
      autoExpire: 'Expirar automaticamente orçamentos vencidos',
      reminder: 'Lembrete de vencimento (dias antes)',
      reminderHint: '0 = sem lembrete',
      draft: 'Rascunho',
      confirmed: 'Confirmado',
      save: 'Salvar',
      saving: 'Salvando...',
      saved: 'Configuração atualizada',
      error: 'Não foi possível salvar',
      custom: 'Personalizada',
      standard: 'Padrão',
    }
  }
  if (language === 'es') {
    return {
      title: 'Configuración de presupuestos',
      validity: 'Validez por defecto (días)',
      validityHint: '0 = sin validez automática',
      approveFromDraft: 'Permitir aprobar directo del borrador (saltar "Enviado")',
      convertStatus: 'Estado del pedido generado en la conversión',
      autoExpire: 'Vencer automáticamente presupuestos caducados',
      reminder: 'Recordatorio de vencimiento (días antes)',
      reminderHint: '0 = sin recordatorio',
      draft: 'Borrador',
      confirmed: 'Confirmado',
      save: 'Guardar',
      saving: 'Guardando...',
      saved: 'Configuración actualizada',
      error: 'No se pudo guardar',
      custom: 'Personalizada',
      standard: 'Por defecto',
    }
  }
  return {
    title: 'Quote settings',
    validity: 'Default validity (days)',
    validityHint: '0 = no automatic validity',
    approveFromDraft: 'Allow approving straight from draft (skip "Sent")',
    convertStatus: 'Order status on conversion',
    autoExpire: 'Auto-expire overdue quotes',
    reminder: 'Expiry reminder (days before)',
    reminderHint: '0 = no reminder',
    draft: 'Draft',
    confirmed: 'Confirmed',
    save: 'Save',
    saving: 'Saving...',
    saved: 'Settings updated',
    error: 'Could not save',
    custom: 'Custom',
    standard: 'Default',
  }
}

const numInput = 'mt-1 h-10 w-24 rounded-md border border-theme bg-transparent px-3 text-sm'

export default function QuoteSettingsCard() {
  const { language } = useSettings()
  const c = copy(language)
  const qc = useQueryClient()

  const q = useQuery({
    queryKey: ['quote-settings'],
    queryFn: () => api<Resp>('/api/admin/settings/sales-quote'),
    retry: false,
  })

  const [form, setForm] = useState<Settings | null>(null)
  useEffect(() => {
    if (q.data && !form) setForm(q.data.settings)
  }, [q.data, form])

  const saveM = useMutation({
    mutationFn: (v: Settings) => api('/api/admin/settings/sales-quote', { method: 'PATCH', body: JSON.stringify(v) }),
    onSuccess: () => {
      toast.success(c.saved)
      void qc.invalidateQueries({ queryKey: ['quote-settings'] })
    },
    onError: () => toast.error(c.error),
  })

  if (q.isError || !q.data || !form) return null

  return (
    <div className="surface rounded-2xl border border-theme p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{c.title}</h2>
        <span className="rounded-lg bg-[var(--surface-2)] px-2 py-1 text-xs font-normal text-[var(--text-muted)]">
          {q.data.isCustom ? c.custom : c.standard}
        </span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium">
          {c.validity}
          <input
            className={numInput}
            type="number"
            min={0}
            max={3650}
            value={form.defaultValidityDays}
            onChange={(e) => setForm({ ...form, defaultValidityDays: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
          />
          <span className="ml-2 text-[var(--text-muted)]">{c.validityHint}</span>
        </label>

        <label className="text-xs font-medium">
          {c.reminder}
          <input
            className={numInput}
            type="number"
            min={0}
            max={365}
            value={form.reminderDaysBefore}
            onChange={(e) => setForm({ ...form, reminderDaysBefore: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
          />
          <span className="ml-2 text-[var(--text-muted)]">{c.reminderHint}</span>
        </label>

        <label className="flex items-center gap-2 text-xs font-medium">
          <input
            type="checkbox"
            checked={form.allowApproveFromDraft}
            onChange={(e) => setForm({ ...form, allowApproveFromDraft: e.target.checked })}
          />
          {c.approveFromDraft}
        </label>

        <label className="flex items-center gap-2 text-xs font-medium">
          <input type="checkbox" checked={form.autoExpire} onChange={(e) => setForm({ ...form, autoExpire: e.target.checked })} />
          {c.autoExpire}
        </label>

        <label className="text-xs font-medium">
          {c.convertStatus}
          <select
            className="mt-1 h-10 w-full rounded-md border border-theme bg-transparent px-3 text-sm"
            value={form.convertedOrderStatus}
            onChange={(e) => setForm({ ...form, convertedOrderStatus: e.target.value as 'DRAFT' | 'CONFIRMED' })}
          >
            <option value="DRAFT">{c.draft}</option>
            <option value="CONFIRMED">{c.confirmed}</option>
          </select>
        </label>
      </div>

      <button className="btn btn-primary btn-sm mt-3" disabled={saveM.isPending} onClick={() => saveM.mutate(form)}>
        {saveM.isPending ? c.saving : c.save}
      </button>
    </div>
  )
}
