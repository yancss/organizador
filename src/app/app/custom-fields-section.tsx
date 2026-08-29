'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from './api-client'
import { useSettings } from './settings-context'
import { toast } from './toast'

type FieldType = 'STRING' | 'NUMBER' | 'CURRENCY' | 'DATE' | 'BOOLEAN' | 'SELECT'
type Field = {
  id: string
  key: string
  label: string
  type: FieldType
  required: boolean
  options: string[]
  helpText: string | null
  value: unknown
}

function copy(language: string) {
  if (language === 'pt') return { title: 'Campos personalizados', save: 'Salvar campos', saved: 'Campos salvos', error: 'Não foi possível salvar', yes: 'Sim', no: 'Não', pick: 'Selecione' }
  if (language === 'es') return { title: 'Campos personalizados', save: 'Guardar campos', saved: 'Campos guardados', error: 'No se pudo guardar', yes: 'Sí', no: 'No', pick: 'Selecciona' }
  return { title: 'Custom fields', save: 'Save fields', saved: 'Fields saved', error: 'Could not save', yes: 'Yes', no: 'No', pick: 'Select' }
}

const inputCls = 'mt-1 h-10 w-full rounded-md border border-theme bg-transparent px-3 text-sm'

export function CustomFieldsSection({ entity, entityId }: { entity: string; entityId: string }) {
  const { language } = useSettings()
  const c = copy(language)
  const qc = useQueryClient()
  const key = ['custom-field-values', entity, entityId]

  const q = useQuery({
    queryKey: key,
    enabled: !!entityId,
    queryFn: () => api<{ fields: Field[] }>(`/api/custom-fields/values?entity=${entity}&entityId=${entityId}`),
  })

  const [form, setForm] = useState<Record<string, unknown> | null>(null)
  useEffect(() => {
    if (q.data && !form) {
      setForm(Object.fromEntries(q.data.fields.map((f) => [f.key, f.value ?? ''])))
    }
  }, [q.data, form])

  const saveM = useMutation({
    mutationFn: () => api('/api/custom-fields/values', { method: 'PUT', body: JSON.stringify({ entity, entityId, values: form ?? {} }) }),
    onSuccess: () => {
      toast.success(c.saved)
      void qc.invalidateQueries({ queryKey: key })
    },
    onError: () => toast.error(c.error),
  })

  const fields = q.data?.fields ?? []
  if (!q.isLoading && fields.length === 0) return null
  if (!form) return null

  const set = (k: string, v: unknown) => setForm({ ...form, [k]: v })

  return (
    <section className="surface rounded-2xl border border-theme p-4">
      <h2 className="text-sm font-semibold text-[var(--foreground)]">{c.title}</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <label key={f.id} className="text-xs font-medium">
            {f.label}
            {f.required ? <span className="text-red-600"> *</span> : null}
            {f.type === 'BOOLEAN' ? (
              <select className={inputCls} value={String(form[f.key] ?? '')} onChange={(e) => set(f.key, e.target.value === '' ? '' : e.target.value === 'true')}>
                <option value="">—</option>
                <option value="true">{c.yes}</option>
                <option value="false">{c.no}</option>
              </select>
            ) : f.type === 'SELECT' ? (
              <select className={inputCls} value={String(form[f.key] ?? '')} onChange={(e) => set(f.key, e.target.value)}>
                <option value="">{c.pick}</option>
                {f.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className={inputCls}
                type={f.type === 'DATE' ? 'date' : f.type === 'NUMBER' || f.type === 'CURRENCY' ? 'number' : 'text'}
                step={f.type === 'CURRENCY' ? '0.01' : undefined}
                value={String(form[f.key] ?? '')}
                onChange={(e) => set(f.key, e.target.value)}
              />
            )}
            {f.helpText ? <span className="mt-0.5 block font-normal text-[var(--text-muted)]">{f.helpText}</span> : null}
          </label>
        ))}
      </div>
      <button className="btn btn-primary btn-sm mt-3" disabled={saveM.isPending} onClick={() => saveM.mutate()}>
        {c.save}
      </button>
    </section>
  )
}
