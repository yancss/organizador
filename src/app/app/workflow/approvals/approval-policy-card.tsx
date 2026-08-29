'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '../../api-client'
import { useSettings } from '../../settings-context'
import { toast } from '../../toast'

type PolicyResponse = {
  policy: {
    purchaseOrderAmountThreshold: number
    salesDiscountPercentThreshold: number
    salesDiscountValueThreshold: number
  }
  defaults: PolicyResponse['policy']
  isCustom: boolean
  updatedAt: string | null
}

function copy(language: string) {
  if (language === 'pt') {
    return {
      title: 'Política de alçadas',
      subtitle: 'Limites que disparam aprovação. Valem para todo o workspace.',
      poThreshold: 'Compra acima de',
      discPct: 'Desconto acima de (%)',
      discValue: 'Desconto acima de (valor)',
      save: 'Salvar',
      saving: 'Salvando...',
      saved: 'Política atualizada',
      usingDefaults: 'Usando os valores padrão',
      custom: 'Personalizada para este workspace',
      restore: 'Restaurar padrão',
      error: 'Não foi possível salvar',
    }
  }
  if (language === 'es') {
    return {
      title: 'Política de umbrales',
      subtitle: 'Límites que disparan aprobación. Aplican a todo el workspace.',
      poThreshold: 'Compra por encima de',
      discPct: 'Descuento por encima de (%)',
      discValue: 'Descuento por encima de (valor)',
      save: 'Guardar',
      saving: 'Guardando...',
      saved: 'Política actualizada',
      usingDefaults: 'Usando los valores por defecto',
      custom: 'Personalizada para este workspace',
      restore: 'Restaurar por defecto',
      error: 'No se pudo guardar',
    }
  }
  return {
    title: 'Approval thresholds',
    subtitle: 'Limits that trigger an approval. Apply to the whole workspace.',
    poThreshold: 'Purchase above',
    discPct: 'Discount above (%)',
    discValue: 'Discount above (value)',
    save: 'Save',
    saving: 'Saving...',
    saved: 'Policy updated',
    usingDefaults: 'Using default values',
    custom: 'Customized for this workspace',
    restore: 'Restore defaults',
    error: 'Could not save',
  }
}

export default function ApprovalPolicyCard() {
  const { language } = useSettings()
  const c = copy(language)
  const qc = useQueryClient()

  const q = useQuery({
    queryKey: ['approval-policy'],
    // Admin-only endpoint: a non-admin gets 403 and the card stays hidden.
    queryFn: () => api<PolicyResponse>('/api/admin/settings/approval-policies'),
    retry: false,
  })

  const [form, setForm] = useState<PolicyResponse['policy'] | null>(null)
  useEffect(() => {
    if (q.data?.policy && !form) setForm(q.data.policy)
  }, [q.data, form])

  const saveM = useMutation({
    mutationFn: (value: PolicyResponse['policy']) =>
      api('/api/admin/settings/approval-policies', { method: 'PATCH', body: JSON.stringify(value) }),
    onSuccess: () => {
      toast.success(c.saved)
      void qc.invalidateQueries({ queryKey: ['approval-policy'] })
    },
    onError: () => toast.error(c.error),
  })

  if (q.isError || !q.data || !form) return null

  const num = (v: string) => {
    const n = Number(v)
    return Number.isFinite(n) && n >= 0 ? n : 0
  }

  return (
    <div className="surface rounded-2xl border border-theme p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{c.title}</h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{c.subtitle}</p>
        </div>
        <span className="rounded-lg bg-[var(--surface-2)] px-2 py-1 text-xs text-[var(--text-muted)]">
          {q.data.isCustom ? c.custom : c.usingDefaults}
        </span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-medium">
          {c.poThreshold}
          <input
            className="mt-1 h-10 w-full rounded-md border border-theme bg-transparent px-3 text-sm"
            type="number"
            min={0}
            value={form.purchaseOrderAmountThreshold}
            onChange={(e) => setForm({ ...form, purchaseOrderAmountThreshold: num(e.target.value) })}
          />
        </label>
        <label className="text-xs font-medium">
          {c.discPct}
          <input
            className="mt-1 h-10 w-full rounded-md border border-theme bg-transparent px-3 text-sm"
            type="number"
            min={0}
            max={100}
            value={form.salesDiscountPercentThreshold}
            onChange={(e) => setForm({ ...form, salesDiscountPercentThreshold: num(e.target.value) })}
          />
        </label>
        <label className="text-xs font-medium">
          {c.discValue}
          <input
            className="mt-1 h-10 w-full rounded-md border border-theme bg-transparent px-3 text-sm"
            type="number"
            min={0}
            value={form.salesDiscountValueThreshold}
            onChange={(e) => setForm({ ...form, salesDiscountValueThreshold: num(e.target.value) })}
          />
        </label>
      </div>

      <div className="mt-3 flex gap-2">
        <button className="btn btn-primary btn-sm" disabled={saveM.isPending} onClick={() => saveM.mutate(form)}>
          {saveM.isPending ? c.saving : c.save}
        </button>
        <button
          className="btn btn-secondary btn-sm"
          disabled={saveM.isPending}
          onClick={() => setForm(q.data.defaults)}
          type="button"
        >
          {c.restore}
        </button>
      </div>
    </div>
  )
}
