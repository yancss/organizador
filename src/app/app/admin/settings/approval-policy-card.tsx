'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '../../api-client'
import { useSettings } from '../../settings-context'
import { toast } from '../../toast'

type Policy = {
  purchaseOrderAmountThreshold: number
  salesDiscountValueThreshold: number
  salesDiscountMaxByRole: { USER: number; ADMIN: number }
  salesDiscountHardCapPercent: number
}
type PolicyResponse = { policy: Policy; defaults: Policy; isCustom: boolean; updatedAt: string | null }

function copy(language: string) {
  if (language === 'pt') {
    return {
      title: 'Política de alçadas',
      subtitle: 'Limites que disparam aprovação. Valem para todo o workspace.',
      poThreshold: 'Compra acima de',
      discUser: 'Desconto sem aprovação — vendedor (%)',
      discAdmin: 'Desconto sem aprovação — admin (%)',
      hardCap: 'Teto rígido de desconto (%)',
      hardCapHint: 'acima disso é recusado, nem com aprovação',
      discValue: 'Desconto acima deste valor sempre pede aprovação',
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
      discUser: 'Descuento sin aprobación — vendedor (%)',
      discAdmin: 'Descuento sin aprobación — admin (%)',
      hardCap: 'Tope rígido de descuento (%)',
      hardCapHint: 'por encima se rechaza, ni con aprobación',
      discValue: 'Descuento sobre este valor siempre pide aprobación',
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
    discUser: 'Discount without approval — seller (%)',
    discAdmin: 'Discount without approval — admin (%)',
    hardCap: 'Hard discount cap (%)',
    hardCapHint: 'above this it is refused, even with approval',
    discValue: 'Discount over this value always needs approval',
    save: 'Save',
    saving: 'Saving...',
    saved: 'Policy updated',
    usingDefaults: 'Using default values',
    custom: 'Customized for this workspace',
    restore: 'Restore defaults',
    error: 'Could not save',
  }
}

const inputCls = 'mt-1 h-10 w-full rounded-md border border-theme bg-transparent px-3 text-sm'

export default function ApprovalPolicyCard() {
  const { language } = useSettings()
  const c = copy(language)
  const qc = useQueryClient()

  const q = useQuery({
    queryKey: ['approval-policy'],
    queryFn: () => api<PolicyResponse>('/api/admin/settings/approval-policies'),
    retry: false,
  })

  const [form, setForm] = useState<Policy | null>(null)
  useEffect(() => {
    if (q.data?.policy && !form) setForm(q.data.policy)
  }, [q.data, form])

  const saveM = useMutation({
    mutationFn: (value: Policy) => api('/api/admin/settings/approval-policies', { method: 'PATCH', body: JSON.stringify(value) }),
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
  const pct = (v: string) => Math.min(100, num(v))

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

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium">
          {c.poThreshold}
          <input className={inputCls} type="number" min={0} value={form.purchaseOrderAmountThreshold}
            onChange={(e) => setForm({ ...form, purchaseOrderAmountThreshold: num(e.target.value) })} />
        </label>
        <label className="text-xs font-medium">
          {c.discValue}
          <input className={inputCls} type="number" min={0} value={form.salesDiscountValueThreshold}
            onChange={(e) => setForm({ ...form, salesDiscountValueThreshold: num(e.target.value) })} />
        </label>
        <label className="text-xs font-medium">
          {c.discUser}
          <input className={inputCls} type="number" min={0} max={100} value={form.salesDiscountMaxByRole.USER}
            onChange={(e) => setForm({ ...form, salesDiscountMaxByRole: { ...form.salesDiscountMaxByRole, USER: pct(e.target.value) } })} />
        </label>
        <label className="text-xs font-medium">
          {c.discAdmin}
          <input className={inputCls} type="number" min={0} max={100} value={form.salesDiscountMaxByRole.ADMIN}
            onChange={(e) => setForm({ ...form, salesDiscountMaxByRole: { ...form.salesDiscountMaxByRole, ADMIN: pct(e.target.value) } })} />
        </label>
        <label className="text-xs font-medium sm:col-span-2">
          {c.hardCap}
          <input className={inputCls} type="number" min={0} max={100} value={form.salesDiscountHardCapPercent}
            onChange={(e) => setForm({ ...form, salesDiscountHardCapPercent: pct(e.target.value) })} />
          <span className="ml-2 text-[var(--text-muted)]">{c.hardCapHint}</span>
        </label>
      </div>

      <div className="mt-3 flex gap-2">
        <button className="btn btn-primary btn-sm" disabled={saveM.isPending} onClick={() => saveM.mutate(form)}>
          {saveM.isPending ? c.saving : c.save}
        </button>
        <button className="btn btn-secondary btn-sm" disabled={saveM.isPending} onClick={() => setForm(q.data.defaults)} type="button">
          {c.restore}
        </button>
      </div>
    </div>
  )
}
