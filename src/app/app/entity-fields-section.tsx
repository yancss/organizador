'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from './api-client'
import { useSettings } from './settings-context'
import { toast } from './toast'

type Field = {
  source: 'native' | 'custom'
  key: string
  label: string
  kind: string
  editable: boolean
  required: boolean
  options: string[]
  helpText: string | null
  value: unknown
}

function copy(language: string) {
  if (language === 'pt') return { title: 'Campos', save: 'Salvar campos', saved: 'Campos salvos', error: 'Não foi possível salvar', yes: 'Sim', no: 'Não', pick: 'Selecione', empty: '—' }
  if (language === 'es') return { title: 'Campos', save: 'Guardar campos', saved: 'Campos guardados', error: 'No se pudo guardar', yes: 'Sí', no: 'No', pick: 'Selecciona', empty: '—' }
  return { title: 'Fields', save: 'Save fields', saved: 'Fields saved', error: 'Could not save', yes: 'Yes', no: 'No', pick: 'Select', empty: '—' }
}

const inputCls = 'mt-1 h-10 w-full rounded-md border border-theme bg-transparent px-3 text-sm'
const NUMERIC = new Set(['number', 'currency'])

function displayValue(f: Field, c: ReturnType<typeof copy>) {
  if (f.value === null || f.value === undefined || f.value === '') return c.empty
  if (f.kind === 'boolean') return f.value ? c.yes : c.no
  return String(f.value)
}

export function EntityFieldsSection({ entity, entityId }: { entity: string; entityId: string }) {
  const { language } = useSettings()
  const c = copy(language)
  const qc = useQueryClient()
  const qk = ['entity-fields', entity, entityId]

  const q = useQuery({
    queryKey: qk,
    enabled: !!entityId,
    queryFn: () => api<{ fields: Field[] }>(`/api/entity-fields?entity=${entity}&entityId=${entityId}`),
  })

  const [form, setForm] = useState<Record<string, unknown> | null>(null)
  useEffect(() => {
    if (q.data && !form) {
      setForm(Object.fromEntries(q.data.fields.filter((f) => f.editable).map((f) => [f.key, f.value ?? ''])))
    }
  }, [q.data, form])

  const saveM = useMutation({
    mutationFn: () => api('/api/entity-fields', { method: 'PUT', body: JSON.stringify({ entity, entityId, values: form ?? {} }) }),
    onSuccess: () => {
      toast.success(c.saved)
      void qc.invalidateQueries({ queryKey: qk })
    },
    onError: () => toast.error(c.error),
  })

  const fields = q.data?.fields ?? []
  if (!q.isLoading && fields.length === 0) return null
  if (!form) return null

  const hasEditable = fields.some((f) => f.editable)
  const set = (k: string, v: unknown) => setForm({ ...form, [k]: v })

  return (
    <section className="surface rounded-2xl border border-theme p-4">
      <h2 className="text-sm font-semibold text-[var(--foreground)]">{c.title}</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.key} className="text-xs font-medium">
            {f.label}
            {f.required ? <span className="text-red-600"> *</span> : null}
            {!f.editable ? (
              <div className="mt-1 text-sm font-normal text-[var(--text-muted)]">{displayValue(f, c)}</div>
            ) : f.kind === 'boolean' ? (
              <select className={inputCls} value={String(form[f.key] ?? '')} onChange={(e) => set(f.key, e.target.value === '' ? '' : e.target.value === 'true')}>
                <option value="">—</option>
                <option value="true">{c.yes}</option>
                <option value="false">{c.no}</option>
              </select>
            ) : f.kind === 'select' && f.options.length ? (
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
                type={f.kind === 'date' ? 'date' : NUMERIC.has(f.kind) ? 'number' : 'text'}
                step={f.kind === 'currency' ? '0.01' : undefined}
                value={String(form[f.key] ?? '')}
                onChange={(e) => set(f.key, e.target.value)}
              />
            )}
            {f.helpText ? <span className="mt-0.5 block font-normal text-[var(--text-muted)]">{f.helpText}</span> : null}
          </div>
        ))}
      </div>
      {hasEditable ? (
        <button className="btn btn-primary btn-sm mt-3" disabled={saveM.isPending} onClick={() => saveM.mutate()}>
          {c.save}
        </button>
      ) : null}
    </section>
  )
}
