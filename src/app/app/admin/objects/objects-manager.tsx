'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '../../api-client'
import { useSettings } from '../../settings-context'
import { toast } from '../../toast'

type FieldType = 'STRING' | 'NUMBER' | 'CURRENCY' | 'DATE' | 'BOOLEAN' | 'SELECT'
type NativeKind = 'text' | 'number' | 'currency' | 'boolean' | 'date' | 'enum' | 'json' | 'relation'

type Labels = { pt: string; es: string; en: string }
type ObjectRow = { key: string; group: string; labels: Labels; nativeCount: number; relationCount: number; customCount: number }
type NativeField = {
  name: string
  defaultLabel: string
  label: string
  configuredLabel: string | null
  visible: boolean
  editable: boolean
  editableEligible: boolean
  order: number
  kind: NativeKind
  rawType: string
  required: boolean
  list: boolean
  system: boolean
  enumValues?: string[]
}
type CustomDef = {
  id: string
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
type Detail = { entity: string; labels: Labels; native: { scalars: NativeField[]; relations: NativeField[] }; custom: CustomDef[] }

function tr(language: string) {
  const pt = {
    title: 'Objetos do sistema',
    subtitle: 'Todos os campos de cada objeto — os nativos (só leitura) e os personalizados.',
    native: 'Campos nativos',
    nativeHint: 'Definidos pela aplicação. Ative "Visível" para mostrar na tela do usuário; ajuste o rótulo e libere a edição (onde possível).',
    relations: 'Relacionamentos',
    custom: 'Campos personalizados',
    system: 'sistema',
    required: 'Obrigatório',
    optional: 'Opcional',
    list: 'lista',
    field: 'Campo',
    type: 'Tipo',
    order: 'Ordem',
    active: 'Ativo',
    rotulo: 'Rótulo (tela do usuário)',
    visivel: 'Visível',
    editavel: 'Editável',
    notEligible: 'Este campo não pode ser editado pelo usuário.',
    labelPlaceholder: 'Padrão',
    add: 'Adicionar campo',
    label: 'Nome do campo',
    help: 'Texto de ajuda',
    options: 'Opções (uma por linha)',
    remove: 'Excluir',
    deactivate: 'Desativar',
    activate: 'Ativar',
    none: 'Nenhum campo personalizado neste objeto.',
    inUse: (n: number) => `${n} valor(es)`,
    hasValues: 'Campo com valores — desative em vez de excluir.',
    saved: 'Salvo',
    error: 'Não foi possível concluir',
    groups: {
      commercial: 'Comercial',
      purchasing: 'Compras',
      catalog: 'Catálogo',
      inventory: 'Estoque',
      logistics: 'Logística',
      finance: 'Financeiro',
      fiscal: 'Fiscal',
    } as Record<string, string>,
    types: { STRING: 'Texto', NUMBER: 'Número', CURRENCY: 'Moeda', DATE: 'Data', BOOLEAN: 'Sim/Não', SELECT: 'Lista' } as Record<FieldType, string>,
    nativeKinds: {
      text: 'Texto', number: 'Número', currency: 'Moeda', boolean: 'Sim/Não', date: 'Data/hora', enum: 'Lista fixa', json: 'JSON', relation: 'Relação',
    } as Record<NativeKind, string>,
  }
  const es: typeof pt = {
    ...pt,
    title: 'Objetos del sistema',
    subtitle: 'Todos los campos de cada objeto — los nativos (solo lectura) y los personalizados.',
    native: 'Campos nativos',
    nativeHint: 'Definidos por la aplicación. El administrador los ve, pero no los cambia.',
    relations: 'Relaciones',
    custom: 'Campos personalizados',
    system: 'sistema', required: 'Obligatorio', optional: 'Opcional', list: 'lista',
    field: 'Campo', type: 'Tipo', order: 'Orden', active: 'Activo',
    add: 'Agregar campo', label: 'Nombre del campo', help: 'Texto de ayuda', options: 'Opciones (una por línea)',
    remove: 'Eliminar', deactivate: 'Desactivar', activate: 'Activar',
    none: 'No hay campos personalizados en este objeto.', inUse: (n: number) => `${n} valor(es)`,
    hasValues: 'Campo con valores — desactívalo en vez de eliminar.', saved: 'Guardado', error: 'No se pudo completar',
    groups: { commercial: 'Comercial', purchasing: 'Compras', catalog: 'Catálogo', inventory: 'Inventario', logistics: 'Logística', finance: 'Finanzas', fiscal: 'Fiscal' },
    types: { STRING: 'Texto', NUMBER: 'Número', CURRENCY: 'Moneda', DATE: 'Fecha', BOOLEAN: 'Sí/No', SELECT: 'Lista' },
    nativeKinds: { text: 'Texto', number: 'Número', currency: 'Moneda', boolean: 'Sí/No', date: 'Fecha/hora', enum: 'Lista fija', json: 'JSON', relation: 'Relación' },
  }
  const en: typeof pt = {
    ...pt,
    title: 'System objects',
    subtitle: 'Every field of each object — native (read-only) and custom.',
    native: 'Native fields',
    nativeHint: 'Defined by the application. The admin can see them but not change them.',
    relations: 'Relationships',
    custom: 'Custom fields',
    system: 'system', required: 'Required', optional: 'Optional', list: 'list',
    field: 'Field', type: 'Type', order: 'Order', active: 'Active',
    add: 'Add field', label: 'Field name', help: 'Help text', options: 'Options (one per line)',
    remove: 'Delete', deactivate: 'Deactivate', activate: 'Activate',
    none: 'No custom fields on this object.', inUse: (n: number) => `${n} value(s)`,
    hasValues: 'Field has values — deactivate instead of deleting.', saved: 'Saved', error: 'Could not complete',
    groups: { commercial: 'Commercial', purchasing: 'Purchasing', catalog: 'Catalog', inventory: 'Inventory', logistics: 'Logistics', finance: 'Finance', fiscal: 'Fiscal' },
    types: { STRING: 'Text', NUMBER: 'Number', CURRENCY: 'Currency', DATE: 'Date', BOOLEAN: 'Yes/No', SELECT: 'List' },
    nativeKinds: { text: 'Text', number: 'Number', currency: 'Currency', boolean: 'Yes/No', date: 'Date/time', enum: 'Fixed list', json: 'JSON', relation: 'Relation' },
  }
  return language === 'pt' ? pt : language === 'es' ? es : en
}

const inputCls = 'h-10 w-full rounded-md border border-theme bg-transparent px-3 text-sm'
const CUSTOM_TYPES: FieldType[] = ['STRING', 'NUMBER', 'CURRENCY', 'DATE', 'BOOLEAN', 'SELECT']

export default function ObjectsManager() {
  const { language } = useSettings()
  const c = tr(language)
  const qc = useQueryClient()
  const lbl = (l: Labels) => (language === 'pt' ? l.pt : language === 'es' ? l.es : l.en)

  const listQ = useQuery({ queryKey: ['admin-objects'], queryFn: () => api<{ objects: ObjectRow[] }>('/api/admin/objects'), retry: false })
  const [entity, setEntity] = useState<string>('')
  const selected = entity || listQ.data?.objects[0]?.key || ''

  const detailQ = useQuery({
    queryKey: ['admin-object', selected],
    enabled: !!selected,
    queryFn: () => api<Detail>(`/api/admin/objects/${selected}`),
  })

  const [showRelations, setShowRelations] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newType, setNewType] = useState<FieldType>('STRING')
  const [newRequired, setNewRequired] = useState(false)
  const [newHelp, setNewHelp] = useState('')
  const [newOptions, setNewOptions] = useState('')

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['admin-object', selected] })
    void qc.invalidateQueries({ queryKey: ['admin-objects'] })
  }

  const createM = useMutation({
    mutationFn: () =>
      api('/api/admin/custom-fields', {
        method: 'POST',
        body: JSON.stringify({
          entity: selected,
          label: newLabel.trim(),
          type: newType,
          required: newRequired,
          helpText: newHelp.trim() || null,
          options: newType === 'SELECT' ? newOptions.split('\n').map((s) => s.trim()).filter(Boolean) : [],
        }),
      }),
    onSuccess: () => {
      toast.success(c.saved)
      setNewLabel(''); setNewHelp(''); setNewOptions(''); setNewRequired(false)
      invalidate()
    },
    onError: () => toast.error(c.error),
  })
  const patchM = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CustomDef> }) => api(`/api/admin/custom-fields/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: invalidate,
    onError: () => toast.error(c.error),
  })
  const nativeCfgM = useMutation({
    mutationFn: ({ fieldName, data }: { fieldName: string; data: Record<string, unknown> }) =>
      api(`/api/admin/objects/${selected}/fields/${fieldName}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: invalidate,
    onError: (e: any) => toast.error(String(e?.message ?? '').includes('FIELD_NOT_EDITABLE') ? c.notEligible : c.error),
  })
  const delM = useMutation({
    mutationFn: (id: string) => api(`/api/admin/custom-fields/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
    onError: (e: any) => toast.error(String(e?.message ?? '').includes('HAS_VALUES') ? c.hasValues : c.error),
  })

  const objectsByGroup = useMemo(() => {
    const map = new Map<string, ObjectRow[]>()
    for (const o of listQ.data?.objects ?? []) {
      if (!map.has(o.group)) map.set(o.group, [])
      map.get(o.group)!.push(o)
    }
    return [...map.entries()]
  }, [listQ.data])

  const d = detailQ.data

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-theme bg-[var(--surface-2)] px-5 py-5 shadow-[var(--shadow-sm)]">
        <h1 className="text-xl font-semibold">{c.title}</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{c.subtitle}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="surface rounded-2xl border border-theme p-2">
          {objectsByGroup.map(([group, objs]) => (
            <div key={group} className="mb-2">
              <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{c.groups[group] ?? group}</div>
              {objs.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setEntity(o.key)}
                  className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm ${selected === o.key ? 'bg-[var(--surface-3)] font-medium' : 'hover:bg-[var(--surface-2)]'}`}
                >
                  <span>{lbl(o.labels)}</span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {o.nativeCount}
                    {o.customCount ? ` +${o.customCount}` : ''}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </aside>

        <div className="space-y-4">
          {!d ? (
            <div className="surface rounded-2xl border border-theme p-6 text-sm text-[var(--text-muted)]">…</div>
          ) : (
            <>
              <section className="surface rounded-2xl border border-theme p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">{c.native}</h2>
                  <span className="text-xs text-[var(--text-muted)]">{d.native.scalars.length}</span>
                </div>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{c.nativeHint}</p>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-theme text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                        <th className="px-2 py-1.5">{c.field}</th>
                        <th className="px-2 py-1.5">{c.rotulo}</th>
                        <th className="px-2 py-1.5">{c.type}</th>
                        <th className="px-2 py-1.5">{c.visivel}</th>
                        <th className="px-2 py-1.5">{c.editavel}</th>
                        <th className="px-2 py-1.5">{c.order}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.native.scalars.map((f) => (
                        <tr key={f.name} className="border-b border-theme/50">
                          <td className={`px-2 py-1.5 ${f.system ? 'text-[var(--text-muted)]' : ''}`}>
                            <code>{f.name}</code>
                            {f.system ? <span className="ml-2 rounded bg-[var(--surface-3)] px-1.5 py-0.5 text-[10px]">{c.system}</span> : null}
                            {f.list ? <span className="ml-1 text-xs">[{c.list}]</span> : null}
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              className="h-8 w-40 rounded border border-theme bg-transparent px-2 text-sm"
                              defaultValue={f.configuredLabel ?? ''}
                              placeholder={f.defaultLabel}
                              onBlur={(e) => {
                                const v = e.target.value.trim()
                                if (v !== (f.configuredLabel ?? '')) nativeCfgM.mutate({ fieldName: f.name, data: { label: v || null } })
                              }}
                            />
                          </td>
                          <td className="px-2 py-1.5 text-[var(--text-muted)]">
                            {c.nativeKinds[f.kind]}
                            {f.enumValues?.length ? <span className="text-xs"> ({f.enumValues.join(', ')})</span> : null}
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="checkbox" checked={f.visible} onChange={(e) => nativeCfgM.mutate({ fieldName: f.name, data: { visible: e.target.checked } })} />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="checkbox"
                              checked={f.editable}
                              disabled={!f.editableEligible}
                              title={!f.editableEligible ? c.notEligible : undefined}
                              onChange={(e) => nativeCfgM.mutate({ fieldName: f.name, data: { editable: e.target.checked } })}
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              className="h-8 w-14 rounded border border-theme bg-transparent px-2 text-sm"
                              type="number"
                              defaultValue={f.order}
                              onBlur={(e) => {
                                const v = Number(e.target.value)
                                if (Number.isFinite(v) && v !== f.order) nativeCfgM.mutate({ fieldName: f.name, data: { order: v } })
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {d.native.relations.length ? (
                  <div className="mt-3">
                    <button className="text-xs font-medium text-[var(--primary)] underline" onClick={() => setShowRelations((v) => !v)}>
                      {c.relations} ({d.native.relations.length})
                    </button>
                    {showRelations ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {d.native.relations.map((r) => (
                          <span key={r.name} className="rounded-lg bg-[var(--surface-2)] px-2 py-1 text-xs">
                            {r.name} → {r.rawType}
                            {r.list ? '[]' : ''}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </section>

              <section className="surface rounded-2xl border border-theme p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">{c.custom}</h2>
                  <span className="text-xs text-[var(--text-muted)]">{d.custom.length}</span>
                </div>

                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-theme text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                        <th className="px-2 py-1.5">{c.field}</th>
                        <th className="px-2 py-1.5">{c.type}</th>
                        <th className="px-2 py-1.5">{c.required}</th>
                        <th className="px-2 py-1.5">{c.order}</th>
                        <th className="px-2 py-1.5">{c.active}</th>
                        <th className="px-2 py-1.5"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.custom.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-2 py-4 text-center text-[var(--text-muted)]">
                            {c.none}
                          </td>
                        </tr>
                      ) : (
                        d.custom.map((f) => (
                          <tr key={f.id} className="border-b border-theme/50">
                            <td className="px-2 py-1.5">
                              <input
                                className="h-8 w-44 rounded border border-theme bg-transparent px-2 text-sm font-medium"
                                defaultValue={f.label}
                                onBlur={(e) => {
                                  const v = e.target.value.trim()
                                  if (v && v !== f.label) patchM.mutate({ id: f.id, data: { label: v } })
                                }}
                              />
                              <input
                                className="mt-1 h-7 w-full rounded border border-theme bg-transparent px-2 text-xs"
                                defaultValue={f.helpText ?? ''}
                                placeholder={c.help}
                                onBlur={(e) => {
                                  const v = e.target.value.trim()
                                  if (v !== (f.helpText ?? '')) patchM.mutate({ id: f.id, data: { helpText: v || null } })
                                }}
                              />
                              <div className="mt-0.5 text-xs text-[var(--text-muted)]">
                                <code>{f.key}</code>
                                {f._count.values ? ` · ${c.inUse(f._count.values)}` : ''}
                              </div>
                            </td>
                            <td className="px-2 py-1.5">
                              {c.types[f.type]}
                              {f.type === 'SELECT' ? <span className="text-xs text-[var(--text-muted)]"> ({f.options.length})</span> : null}
                            </td>
                            <td className="px-2 py-1.5">
                              <input type="checkbox" checked={f.required} onChange={(e) => patchM.mutate({ id: f.id, data: { required: e.target.checked } })} />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                className="h-8 w-14 rounded border border-theme bg-transparent px-2 text-sm"
                                type="number"
                                defaultValue={f.order}
                                onBlur={(e) => {
                                  const v = Number(e.target.value)
                                  if (Number.isFinite(v) && v !== f.order) patchM.mutate({ id: f.id, data: { order: v } })
                                }}
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <button className="btn btn-secondary btn-sm" onClick={() => patchM.mutate({ id: f.id, data: { active: !f.active } })}>
                                {f.active ? c.deactivate : c.activate}
                              </button>
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <button
                                className="btn btn-danger-soft btn-sm"
                                disabled={f._count.values > 0}
                                title={f._count.values > 0 ? c.hasValues : undefined}
                                onClick={() => delM.mutate(f.id)}
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

                <div className="mt-4 rounded-xl border border-theme p-3">
                  <div className="text-sm font-semibold">{c.add}</div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <label className="text-xs font-medium">
                      {c.label}
                      <input className={`${inputCls} mt-1`} value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
                    </label>
                    <label className="text-xs font-medium">
                      {c.type}
                      <select className={`${inputCls} mt-1`} value={newType} onChange={(e) => setNewType(e.target.value as FieldType)}>
                        {CUSTOM_TYPES.map((t) => (
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
                        <textarea className="mt-1 w-full rounded-md border border-theme bg-transparent px-3 py-2 text-sm" rows={3} value={newOptions} onChange={(e) => setNewOptions(e.target.value)} />
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
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
