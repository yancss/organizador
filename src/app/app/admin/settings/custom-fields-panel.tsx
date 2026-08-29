'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '../../api-client'
import { useSettings } from '../../settings-context'
import { toast } from '../../toast'

type FieldType = 'STRING' | 'NUMBER' | 'CURRENCY' | 'DATE' | 'BOOLEAN' | 'SELECT'

type Definition = {
  id: string
  entity: string
  key: string
  label: string
  type: FieldType
  required: boolean
  active: boolean
  helpText: string | null
  options: string[]
  order: number
  _count: { values: number }
}

type EntityMeta = { key: string; group: string; labels: { pt: string; es: string; en: string } }
type Resp = { entities: EntityMeta[]; types: FieldType[]; definitions: Definition[] }

function copy(language: string) {
  const pt = {
    title: 'Campos personalizados',
    subtitle: 'Crie campos extras nos objetos do sistema, sem alterar o banco.',
    object: 'Objeto',
    label: 'Nome do campo',
    type: 'Tipo',
    required: 'Obrigatório',
    active: 'Ativo',
    order: 'Ordem',
    help: 'Texto de ajuda',
    options: 'Opções (uma por linha)',
    add: 'Adicionar campo',
    save: 'Salvar',
    remove: 'Excluir',
    deactivate: 'Desativar',
    activate: 'Ativar',
    inUse: (n: number) => `${n} valor(es) preenchido(s)`,
    none: 'Nenhum campo neste objeto ainda.',
    saved: 'Salvo',
    error: 'Não foi possível concluir',
    hasValues: 'Campo com valores preenchidos — desative em vez de excluir.',
    key: 'chave',
    types: { STRING: 'Texto', NUMBER: 'Número', CURRENCY: 'Moeda', DATE: 'Data', BOOLEAN: 'Sim/Não', SELECT: 'Lista' } as Record<FieldType, string>,
  }
  const es: typeof pt = {
    ...pt,
    title: 'Campos personalizados',
    subtitle: 'Crea campos extra en los objetos del sistema, sin tocar la base de datos.',
    object: 'Objeto',
    label: 'Nombre del campo',
    type: 'Tipo',
    required: 'Obligatorio',
    active: 'Activo',
    order: 'Orden',
    help: 'Texto de ayuda',
    options: 'Opciones (una por línea)',
    add: 'Agregar campo',
    save: 'Guardar',
    remove: 'Eliminar',
    deactivate: 'Desactivar',
    activate: 'Activar',
    inUse: (n: number) => `${n} valor(es) cargado(s)`,
    none: 'Aún no hay campos en este objeto.',
    saved: 'Guardado',
    error: 'No se pudo completar',
    hasValues: 'Campo con valores cargados — desactívalo en vez de eliminar.',
    key: 'clave',
    types: { STRING: 'Texto', NUMBER: 'Número', CURRENCY: 'Moneda', DATE: 'Fecha', BOOLEAN: 'Sí/No', SELECT: 'Lista' },
  }
  const en: typeof pt = {
    ...pt,
    title: 'Custom fields',
    subtitle: 'Add extra fields to system objects without touching the database.',
    object: 'Object',
    label: 'Field name',
    type: 'Type',
    required: 'Required',
    active: 'Active',
    order: 'Order',
    help: 'Help text',
    options: 'Options (one per line)',
    add: 'Add field',
    save: 'Save',
    remove: 'Delete',
    deactivate: 'Deactivate',
    activate: 'Activate',
    inUse: (n: number) => `${n} value(s) filled`,
    none: 'No fields on this object yet.',
    saved: 'Saved',
    error: 'Could not complete',
    hasValues: 'Field has values — deactivate instead of deleting.',
    key: 'key',
    types: { STRING: 'Text', NUMBER: 'Number', CURRENCY: 'Currency', DATE: 'Date', BOOLEAN: 'Yes/No', SELECT: 'List' },
  }
  return language === 'pt' ? pt : language === 'es' ? es : en
}

const inputCls = 'h-10 w-full rounded-md border border-theme bg-transparent px-3 text-sm'

export default function CustomFieldsPanel() {
  const { language } = useSettings()
  const c = copy(language)
  const qc = useQueryClient()

  const q = useQuery({ queryKey: ['custom-fields-admin'], queryFn: () => api<Resp>('/api/admin/custom-fields'), retry: false })

  const [entity, setEntity] = useState<string>('')
  const [newLabel, setNewLabel] = useState('')
  const [newType, setNewType] = useState<FieldType>('STRING')
  const [newRequired, setNewRequired] = useState(false)
  const [newHelp, setNewHelp] = useState('')
  const [newOptions, setNewOptions] = useState('')

  const entities = q.data?.entities ?? []
  const selectedEntity = entity || entities[0]?.key || ''
  const defs = useMemo(
    () => (q.data?.definitions ?? []).filter((d) => d.entity === selectedEntity),
    [q.data, selectedEntity],
  )

  const invalidate = () => qc.invalidateQueries({ queryKey: ['custom-fields-admin'] })

  const createM = useMutation({
    mutationFn: () =>
      api('/api/admin/custom-fields', {
        method: 'POST',
        body: JSON.stringify({
          entity: selectedEntity,
          label: newLabel.trim(),
          type: newType,
          required: newRequired,
          helpText: newHelp.trim() || null,
          options: newType === 'SELECT' ? newOptions.split('\n').map((s) => s.trim()).filter(Boolean) : [],
        }),
      }),
    onSuccess: () => {
      toast.success(c.saved)
      setNewLabel('')
      setNewHelp('')
      setNewOptions('')
      setNewRequired(false)
      void invalidate()
    },
    onError: () => toast.error(c.error),
  })

  const patchM = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Definition> }) =>
      api(`/api/admin/custom-fields/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => void invalidate(),
    onError: () => toast.error(c.error),
  })

  const delM = useMutation({
    mutationFn: (id: string) => api(`/api/admin/custom-fields/${id}`, { method: 'DELETE' }),
    onSuccess: () => void invalidate(),
    onError: async (e: any) => {
      toast.error(String(e?.message ?? '').includes('HAS_VALUES') ? c.hasValues : c.error)
    },
  })

  if (q.isError || !q.data) return null

  const entLabel = (e: EntityMeta) => (language === 'pt' ? e.labels.pt : language === 'es' ? e.labels.es : e.labels.en)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">{c.title}</h2>
        <p className="mt-1 text-xs text-[var(--text-muted)]">{c.subtitle}</p>
      </div>

      <label className="block max-w-sm text-xs font-medium">
        {c.object}
        <select className={`${inputCls} mt-1`} value={selectedEntity} onChange={(e) => setEntity(e.target.value)}>
          {entities.map((e) => (
            <option key={e.key} value={e.key}>
              {entLabel(e)}
            </option>
          ))}
        </select>
      </label>

      <div className="surface overflow-x-auto rounded-2xl border border-theme">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-theme text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
              <th className="px-3 py-2">{c.label}</th>
              <th className="px-3 py-2">{c.type}</th>
              <th className="px-3 py-2">{c.required}</th>
              <th className="px-3 py-2">{c.order}</th>
              <th className="px-3 py-2">{c.active}</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {defs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-[var(--text-muted)]">
                  {c.none}
                </td>
              </tr>
            ) : (
              defs.map((d) => (
                <tr key={d.id} className="border-b border-theme/60">
                  <td className="px-3 py-2">
                    <div className="font-medium">{d.label}</div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {c.key}: <code>{d.key}</code>
                      {d._count.values > 0 ? ` · ${c.inUse(d._count.values)}` : ''}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {c.types[d.type]}
                    {d.type === 'SELECT' ? <span className="text-xs text-[var(--text-muted)]"> ({d.options.length})</span> : null}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={d.required}
                      onChange={(e) => patchM.mutate({ id: d.id, data: { required: e.target.checked } })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="h-8 w-16 rounded border border-theme bg-transparent px-2 text-sm"
                      type="number"
                      defaultValue={d.order}
                      onBlur={(e) => {
                        const v = Number(e.target.value)
                        if (Number.isFinite(v) && v !== d.order) patchM.mutate({ id: d.id, data: { order: v } })
                      }}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => patchM.mutate({ id: d.id, data: { active: !d.active } })}
                    >
                      {d.active ? c.deactivate : c.activate}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      className="btn btn-danger-soft btn-sm"
                      disabled={d._count.values > 0}
                      title={d._count.values > 0 ? c.hasValues : undefined}
                      onClick={() => delM.mutate(d.id)}
                    >
                      {c.remove}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="surface rounded-2xl border border-theme p-4">
        <div className="text-sm font-semibold">{c.add}</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium">
            {c.label}
            <input className={`${inputCls} mt-1`} value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
          </label>
          <label className="text-xs font-medium">
            {c.type}
            <select className={`${inputCls} mt-1`} value={newType} onChange={(e) => setNewType(e.target.value as FieldType)}>
              {q.data.types.map((t) => (
                <option key={t} value={t}>
                  {c.types[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs font-medium">
            <input type="checkbox" checked={newRequired} onChange={(e) => setNewRequired(e.target.checked)} />
            {c.required}
          </label>
          <label className="text-xs font-medium">
            {c.help}
            <input className={`${inputCls} mt-1`} value={newHelp} onChange={(e) => setNewHelp(e.target.value)} />
          </label>
          {newType === 'SELECT' ? (
            <label className="text-xs font-medium sm:col-span-2">
              {c.options}
              <textarea
                className="mt-1 w-full rounded-md border border-theme bg-transparent px-3 py-2 text-sm"
                rows={3}
                value={newOptions}
                onChange={(e) => setNewOptions(e.target.value)}
              />
            </label>
          ) : null}
        </div>
        <button
          className="btn btn-primary btn-sm mt-3"
          disabled={createM.isPending || !newLabel.trim() || (newType === 'SELECT' && newOptions.split('\n').filter((s) => s.trim()).length < 2)}
          onClick={() => createM.mutate()}
        >
          {c.add}
        </button>
      </div>
    </div>
  )
}
