'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '../../api-client'
import { useSettings } from '../../settings-context'
import { toast } from '../../toast'

type Resp = {
  settings: { defaultValidityDays: number }
  defaults: { defaultValidityDays: number }
  isCustom: boolean
}

function copy(language: string) {
  if (language === 'pt') {
    return {
      title: 'Validade padrão do orçamento',
      hint: 'Aplicada quando um orçamento é criado sem data. 0 = sem validade automática.',
      days: 'Dias',
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
      title: 'Validez por defecto del presupuesto',
      hint: 'Se aplica cuando un presupuesto se crea sin fecha. 0 = sin validez automática.',
      days: 'Días',
      save: 'Guardar',
      saving: 'Guardando...',
      saved: 'Configuración actualizada',
      error: 'No se pudo guardar',
      custom: 'Personalizada',
      standard: 'Por defecto',
    }
  }
  return {
    title: 'Default quote validity',
    hint: 'Applied when a quote is created without a date. 0 = no automatic validity.',
    days: 'Days',
    save: 'Save',
    saving: 'Saving...',
    saved: 'Settings updated',
    error: 'Could not save',
    custom: 'Custom',
    standard: 'Default',
  }
}

export default function QuoteSettingsCard() {
  const { language } = useSettings()
  const c = copy(language)
  const qc = useQueryClient()

  const q = useQuery({
    queryKey: ['quote-settings'],
    queryFn: () => api<Resp>('/api/admin/settings/sales-quote'),
    retry: false,
  })

  const [days, setDays] = useState<string | null>(null)
  useEffect(() => {
    if (q.data && days === null) setDays(String(q.data.settings.defaultValidityDays))
  }, [q.data, days])

  const saveM = useMutation({
    mutationFn: (v: number) => api('/api/admin/settings/sales-quote', { method: 'PATCH', body: JSON.stringify({ defaultValidityDays: v }) }),
    onSuccess: () => {
      toast.success(c.saved)
      void qc.invalidateQueries({ queryKey: ['quote-settings'] })
    },
    onError: () => toast.error(c.error),
  })

  if (q.isError || !q.data || days === null) return null

  const n = Math.max(0, Math.min(3650, Math.floor(Number(days) || 0)))

  return (
    <div className="surface rounded-2xl border border-theme p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{c.title}</h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{c.hint}</p>
        </div>
        <span className="rounded-lg bg-[var(--surface-2)] px-2 py-1 text-xs text-[var(--text-muted)]">
          {q.data.isCustom ? c.custom : c.standard}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-xs font-medium">
          {c.days}
          <input
            className="mt-1 h-10 w-24 rounded-md border border-theme bg-transparent px-3 text-sm"
            type="number"
            min={0}
            max={3650}
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
        </label>
        <button className="btn btn-primary btn-sm" disabled={saveM.isPending} onClick={() => saveM.mutate(n)}>
          {saveM.isPending ? c.saving : c.save}
        </button>
      </div>
    </div>
  )
}
