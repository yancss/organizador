'use client'

import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '../../api-client'
import { useSettings } from '../../settings-context'
import { toast } from '../../toast'

type FieldType = 'STRING' | 'NUMBER' | 'CURRENCY' | 'DATE' | 'BOOLEAN' | 'SELECT'
type NativeKind = 'text' | 'number' | 'currency' | 'boolean' | 'date' | 'enum' | 'json' | 'relation'

type Labels = { pt: string; es: string; en: string }
type ObjectRow = {
  key: string
  group: string
  labels: Labels
  configuredLabel: string | null
  description: string | null
  nativeCount: number
  relationCount: number
  customCount: number
}
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
type Detail = {
  entity: string
  labels: Labels
  configuredLabel: string | null
  description: string | null
  native: { scalars: NativeField[]; relations: NativeField[] }
  custom: CustomDef[]
}

function tr(language: string) {
  const pt = {
    title: 'Objetos do sistema',
    subtitle: 'Todos os campos de cada objeto — os nativos (só leitura) e os personalizados.',
    object: 'Objeto',
    objectHint: 'Nome e descrição mostrados aos usuários nas telas de processo.',
    objectName: 'Nome de exibição',
    objectDesc: 'Descrição',
    native: 'Campos nativos',
    nativeHint: 'Definidos pela aplicação. Ative "Visível" para mostrar na tela do usuário; ajuste o rótulo e libere a edição (onde possível).',
    relations: 'Relacionamentos',
    custom: 'Campos personalizados',
    system: 'sistema',
    required: 'Obrigatório',
    optional: 'Opcional',
    list: 'lista',
    field: 'Campo',
    colName: 'Nome',
    type: 'Tipo',
    order: 'Ordem',
    active: 'Ativo',
    rotulo: 'Rótulo (tela do usuário)',
    visivel: 'Visível',
    editavel: 'Editável',
    notEligible: 'Este campo não pode ser editado pelo usuário.',
    labelPlaceholder: 'Padrão',
    tabFields: 'Campos',
    tabRelations: 'Relações',
    tabLayout: 'Layout',
    layoutHint: 'Ordem dos campos na tela do usuário. Em breve com arrastar e soltar.',
    layoutEmpty: 'Nenhum campo visível. Ative "Visível" nos campos ou crie campos personalizados.',
    moveUp: 'Subir',
    moveDown: 'Descer',
    sourceNative: 'nativo',
    sourceCustom: 'personalizado',
    relFrom: 'Campo',
    relTo: 'Aponta para',
    add: 'Adicionar campo',
    editTitle: 'Editar campo',
    label: 'Nome do campo',
    help: 'Texto de ajuda',
    options: 'Opções (uma por linha)',
    edit: 'Editar',
    save: 'Salvar',
    cancel: 'Cancelar',
    remove: 'Excluir',
    none: 'Nenhum campo personalizado neste objeto.',
    inUse: (n: number) => `${n} valor(es)`,
    hasValues: 'Campo com valores — desative em vez de excluir.',
    typeLocked: 'Campo com valores — não dá para mudar o tipo.',
    saved: 'Salvo',
    error: 'Não foi possível concluir',
    types: { STRING: 'Texto', NUMBER: 'Número', CURRENCY: 'Moeda', DATE: 'Data', BOOLEAN: 'Sim/Não', SELECT: 'Lista' } as Record<FieldType, string>,
    nativeKinds: {
      text: 'Texto', number: 'Número', currency: 'Moeda', boolean: 'Sim/Não', date: 'Data/hora', enum: 'Lista fixa', json: 'JSON', relation: 'Relação',
    } as Record<NativeKind, string>,
  }
  const es: typeof pt = {
    ...pt,
    title: 'Objetos del sistema',
    subtitle: 'Todos los campos de cada objeto — los nativos (solo lectura) y los personalizados.',
    object: 'Objeto',
    objectHint: 'Nombre y descripción que ven los usuarios en las pantallas de proceso.',
    objectName: 'Nombre visible',
    objectDesc: 'Descripción',
    native: 'Campos nativos',
    nativeHint: 'Definidos por la aplicación. Activa "Visible" para mostrarlo; ajusta el rótulo y libera la edición (donde sea posible).',
    relations: 'Relaciones',
    custom: 'Campos personalizados',
    system: 'sistema', required: 'Obligatorio', optional: 'Opcional', list: 'lista',
    field: 'Campo', colName: 'Nombre', type: 'Tipo', order: 'Orden', active: 'Activo',
    add: 'Agregar campo', editTitle: 'Editar campo', label: 'Nombre del campo', help: 'Texto de ayuda', options: 'Opciones (una por línea)',
    edit: 'Editar', save: 'Guardar', cancel: 'Cancelar', remove: 'Eliminar',
    none: 'No hay campos personalizados en este objeto.', inUse: (n: number) => `${n} valor(es)`,
    hasValues: 'Campo con valores — desactívalo en vez de eliminar.',
    typeLocked: 'Campo con valores — no se puede cambiar el tipo.',
    saved: 'Guardado', error: 'No se pudo completar',
    types: { STRING: 'Texto', NUMBER: 'Número', CURRENCY: 'Moneda', DATE: 'Fecha', BOOLEAN: 'Sí/No', SELECT: 'Lista' },
    nativeKinds: { text: 'Texto', number: 'Número', currency: 'Moneda', boolean: 'Sí/No', date: 'Fecha/hora', enum: 'Lista fija', json: 'JSON', relation: 'Relación' },
    tabFields: 'Campos', tabRelations: 'Relaciones', tabLayout: 'Layout',
    layoutHint: 'Orden de los campos en la pantalla del usuario. Pronto con arrastrar y soltar.',
    layoutEmpty: 'Ningún campo visible. Activa "Visible" o crea campos personalizados.',
    sourceNative: 'nativo', sourceCustom: 'personalizado', relFrom: 'Campo', relTo: 'Apunta a', moveUp: 'Subir', moveDown: 'Bajar',
  }
  const en: typeof pt = {
    ...pt,
    title: 'System objects',
    subtitle: 'Every field of each object — native (read-only) and custom.',
    object: 'Object',
    objectHint: 'Name and description shown to users on process screens.',
    objectName: 'Display name',
    objectDesc: 'Description',
    native: 'Native fields',
    nativeHint: 'Defined by the application. Turn on "Visible" to show it; adjust the label and allow editing (where possible).',
    relations: 'Relationships',
    custom: 'Custom fields',
    system: 'system', required: 'Required', optional: 'Optional', list: 'list',
    field: 'Field', colName: 'Name', type: 'Type', order: 'Order', active: 'Active',
    add: 'Add field', editTitle: 'Edit field', label: 'Field name', help: 'Help text', options: 'Options (one per line)',
    edit: 'Edit', save: 'Save', cancel: 'Cancel', remove: 'Delete',
    none: 'No custom fields on this object.', inUse: (n: number) => `${n} value(s)`,
    hasValues: 'Field has values — deactivate instead of deleting.',
    typeLocked: 'Field has values — the type cannot be changed.',
    saved: 'Saved', error: 'Could not complete',
    types: { STRING: 'Text', NUMBER: 'Number', CURRENCY: 'Currency', DATE: 'Date', BOOLEAN: 'Yes/No', SELECT: 'List' },
    nativeKinds: { text: 'Text', number: 'Number', currency: 'Currency', boolean: 'Yes/No', date: 'Date/time', enum: 'Fixed list', json: 'JSON', relation: 'Relation' },
    tabFields: 'Fields', tabRelations: 'Relationships', tabLayout: 'Layout',
    layoutHint: 'Field order on the user screen. Drag & drop coming soon.',
    layoutEmpty: 'No visible fields. Turn on "Visible" or create custom fields.',
    sourceNative: 'native', sourceCustom: 'custom', relFrom: 'Field', relTo: 'Points to', moveUp: 'Move up', moveDown: 'Move down',
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
  const objName = (o: { configuredLabel: string | null; labels: Labels }) => o.configuredLabel || lbl(o.labels)

  const listQ = useQuery({ queryKey: ['admin-objects'], queryFn: () => api<{ objects: ObjectRow[] }>('/api/admin/objects'), retry: false })
  const [entity, setEntity] = useState<string>('')

  const objects = useMemo(
    () => [...(listQ.data?.objects ?? [])].sort((a, b) => objName(a).localeCompare(objName(b), language)),
    [listQ.data, language],
  )
  const selected = entity || objects[0]?.key || ''

  const detailQ = useQuery({
    queryKey: ['admin-object', selected],
    enabled: !!selected,
    queryFn: () => api<Detail>(`/api/admin/objects/${selected}`),
  })

  const [tab, setTab] = useState<'fields' | 'relations' | 'layout'>('fields')
  const formRef = useRef<HTMLDivElement>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [fLabel, setFLabel] = useState('')
  const [fType, setFType] = useState<FieldType>('STRING')
  const [fRequired, setFRequired] = useState(false)
  const [fActive, setFActive] = useState(true)
  const [fHelp, setFHelp] = useState('')
  const [fOptions, setFOptions] = useState('')

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['admin-object', selected] })
    void qc.invalidateQueries({ queryKey: ['admin-objects'] })
  }

  function resetForm() {
    setEditingId(null)
    setFLabel(''); setFType('STRING'); setFRequired(false); setFActive(true); setFHelp(''); setFOptions('')
  }
  function startEdit(f: CustomDef) {
    setEditingId(f.id)
    setFLabel(f.label)
    setFType(f.type)
    setFRequired(f.required)
    setFActive(f.active)
    setFHelp(f.helpText ?? '')
    setFOptions(f.options.join('\n'))
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  const optionsArr = () => fOptions.split('\n').map((s) => s.trim()).filter(Boolean)
  const formInvalid = !fLabel.trim() || (fType === 'SELECT' && optionsArr().length < 2)

  const saveM = useMutation({
    mutationFn: () => {
      const payload = {
        label: fLabel.trim(),
        type: fType,
        required: fRequired,
        helpText: fHelp.trim() || null,
        options: fType === 'SELECT' ? optionsArr() : [],
      }
      return editingId
        ? api(`/api/admin/custom-fields/${editingId}`, { method: 'PATCH', body: JSON.stringify({ ...payload, active: fActive }) })
        : api('/api/admin/custom-fields', { method: 'POST', body: JSON.stringify({ ...payload, entity: selected }) })
    },
    onSuccess: () => {
      toast.success(c.saved)
      resetForm()
      invalidate()
    },
    onError: (e: any) => toast.error(String(e?.message ?? '').includes('TYPE_LOCKED_WITH_VALUES') ? c.typeLocked : c.error),
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
  const entityCfgM = useMutation({
    mutationFn: (data: { label?: string | null; description?: string | null }) =>
      api(`/api/admin/objects/${selected}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => {
      toast.success(c.saved)
      invalidate()
    },
    onError: () => toast.error(c.error),
  })
  const delM = useMutation({
    mutationFn: (id: string) => api(`/api/admin/custom-fields/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      if (editingId) resetForm()
      invalidate()
    },
    onError: (e: any) => toast.error(String(e?.message ?? '').includes('HAS_VALUES') ? c.hasValues : c.error),
  })

  const d = detailQ.data

  // Layout: lista unificada dos campos visíveis, ordenada.
  type LayoutItem = { source: 'native' | 'custom'; id: string; label: string; order: number }
  const layoutItems: LayoutItem[] = useMemo(() => {
    if (!d) return []
    const items: LayoutItem[] = [
      ...d.native.scalars.filter((f) => f.visible).map((f) => ({ source: 'native' as const, id: f.name, label: f.label, order: f.order })),
      ...d.custom.filter((f) => f.active).map((f) => ({ source: 'custom' as const, id: f.id, label: f.label, order: f.order })),
    ]
    return items.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
  }, [d])

  function moveLayout(index: number, dir: -1 | 1) {
    const next = [...layoutItems]
    const j = index + dir
    if (j < 0 || j >= next.length) return
    ;[next[index], next[j]] = [next[j], next[index]]
    // Renumera 0..n-1 e persiste só o que mudou.
    next.forEach((it, i) => {
      if (it.order === i) return
      if (it.source === 'native') nativeCfgM.mutate({ fieldName: it.id, data: { order: i } })
      else patchM.mutate({ id: it.id, data: { order: i } })
    })
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-theme bg-[var(--surface-2)] px-5 py-5 shadow-[var(--shadow-sm)]">
        <h1 className="text-xl font-semibold">{c.title}</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{c.subtitle}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="surface rounded-2xl border border-theme p-2">
          {objects.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => {
                setEntity(o.key)
                resetForm()
              }}
              className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm ${selected === o.key ? 'bg-[var(--surface-3)] font-medium' : 'hover:bg-[var(--surface-2)]'}`}
            >
              <span>{objName(o)}</span>
              <span className="text-xs text-[var(--text-muted)]">
                {o.nativeCount}
                {o.customCount ? ` +${o.customCount}` : ''}
              </span>
            </button>
          ))}
        </aside>

        <div className="space-y-4">
          {!d ? (
            <div className="surface rounded-2xl border border-theme p-6 text-sm text-[var(--text-muted)]">…</div>
          ) : (
            <>
              <div className="rounded-2xl border border-theme bg-[var(--surface-2)] p-2">
                <div className="flex flex-wrap gap-2">
                  {([
                    ['fields', c.tabFields],
                    ['relations', `${c.tabRelations} (${d.native.relations.length})`],
                    ['layout', c.tabLayout],
                  ] as const).map(([k, labelTxt]) => (
                    <button
                      key={k}
                      type="button"
                      className={`btn btn-sm ${tab === k ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setTab(k)}
                    >
                      {labelTxt}
                    </button>
                  ))}
                </div>
              </div>

              {tab === 'fields' ? (
              <>
              <section key={selected} className="surface rounded-2xl border border-theme p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">{c.object}</h2>
                  <span className="text-xs text-[var(--text-muted)]"><code>{d.entity}</code></span>
                </div>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{c.objectHint}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-medium">
                    {c.objectName}
                    <input
                      className={`${inputCls} mt-1`}
                      defaultValue={d.configuredLabel ?? ''}
                      placeholder={lbl(d.labels)}
                      onBlur={(e) => {
                        const v = e.target.value.trim()
                        if (v !== (d.configuredLabel ?? '')) entityCfgM.mutate({ label: v || null })
                      }}
                    />
                  </label>
                  <label className="text-xs font-medium">
                    {c.objectDesc}
                    <input
                      className={`${inputCls} mt-1`}
                      defaultValue={d.description ?? ''}
                      onBlur={(e) => {
                        const v = e.target.value.trim()
                        if (v !== (d.description ?? '')) entityCfgM.mutate({ description: v || null })
                      }}
                    />
                  </label>
                </div>
              </section>

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
                          <td className="px-2 py-1.5 text-[var(--text-muted)]">{c.nativeKinds[f.kind]}</td>
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
                        <th className="px-2 py-1.5">{c.rotulo}</th>
                        <th className="px-2 py-1.5">{c.colName}</th>
                        <th className="px-2 py-1.5">{c.type}</th>
                        <th className="px-2 py-1.5"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.custom.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-2 py-4 text-center text-[var(--text-muted)]">
                            {c.none}
                          </td>
                        </tr>
                      ) : (
                        d.custom.map((f) => (
                          <tr key={f.id} className={`border-b border-theme/50 ${f.active ? '' : 'opacity-50'} ${editingId === f.id ? 'bg-[var(--surface-2)]' : ''}`}>
                            <td className="px-2 py-1.5 font-medium">
                              {f.label}
                              {f.required ? <span className="ml-1 text-[var(--danger,#c00)]">*</span> : null}
                            </td>
                            <td className="px-2 py-1.5 text-[var(--text-muted)]">
                              <code>{f.key}</code>
                              {f._count.values ? <span className="text-xs"> · {c.inUse(f._count.values)}</span> : null}
                            </td>
                            <td className="px-2 py-1.5 text-[var(--text-muted)]">{c.types[f.type]}</td>
                            <td className="px-2 py-1.5">
                              <div className="flex justify-end gap-1">
                                <button className="btn btn-secondary btn-sm" onClick={() => startEdit(f)}>
                                  {c.edit}
                                </button>
                                <button
                                  className="btn btn-danger-soft btn-sm"
                                  disabled={f._count.values > 0}
                                  title={f._count.values > 0 ? c.hasValues : undefined}
                                  onClick={() => delM.mutate(f.id)}
                                >
                                  {c.remove}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div ref={formRef} className="mt-4 rounded-xl border border-theme p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">{editingId ? c.editTitle : c.add}</div>
                    {editingId ? (
                      <button className="btn btn-secondary btn-sm" onClick={resetForm}>
                        {c.cancel}
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <label className="text-xs font-medium">
                      {c.label}
                      <input className={`${inputCls} mt-1`} value={fLabel} onChange={(e) => setFLabel(e.target.value)} />
                    </label>
                    <label className="text-xs font-medium">
                      {c.type}
                      <select className={`${inputCls} mt-1`} value={fType} onChange={(e) => setFType(e.target.value as FieldType)}>
                        {CUSTOM_TYPES.map((tp) => (
                          <option key={tp} value={tp}>
                            {c.types[tp]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium">
                      <input type="checkbox" checked={fRequired} onChange={(e) => setFRequired(e.target.checked)} />
                      {c.required}
                    </label>
                    {editingId ? (
                      <label className="flex items-center gap-2 text-xs font-medium">
                        <input type="checkbox" checked={fActive} onChange={(e) => setFActive(e.target.checked)} />
                        {c.active}
                      </label>
                    ) : (
                      <span />
                    )}
                    <label className="text-xs font-medium sm:col-span-2">
                      {c.help}
                      <input className={`${inputCls} mt-1`} value={fHelp} onChange={(e) => setFHelp(e.target.value)} />
                    </label>
                    {fType === 'SELECT' ? (
                      <label className="text-xs font-medium sm:col-span-2">
                        {c.options}
                        <textarea className="mt-1 w-full rounded-md border border-theme bg-transparent px-3 py-2 text-sm" rows={3} value={fOptions} onChange={(e) => setFOptions(e.target.value)} />
                      </label>
                    ) : null}
                  </div>
                  <button
                    className="btn btn-primary btn-sm mt-3"
                    disabled={saveM.isPending || formInvalid}
                    onClick={() => saveM.mutate()}
                  >
                    {editingId ? c.save : c.add}
                  </button>
                </div>
              </section>
              </>
              ) : null}

              {tab === 'relations' ? (
                <section className="surface rounded-2xl border border-theme p-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold">{c.tabRelations}</h2>
                    <span className="text-xs text-[var(--text-muted)]">{d.native.relations.length}</span>
                  </div>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-theme text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                          <th className="px-2 py-1.5">{c.relFrom}</th>
                          <th className="px-2 py-1.5">{c.relTo}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.native.relations.map((r) => (
                          <tr key={r.name} className="border-b border-theme/50">
                            <td className="px-2 py-1.5"><code>{r.name}</code></td>
                            <td className="px-2 py-1.5 text-[var(--text-muted)]">
                              {r.rawType}
                              {r.list ? '[]' : ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}

              {tab === 'layout' ? (
                <section className="surface rounded-2xl border border-theme p-4">
                  <h2 className="text-sm font-semibold">{c.tabLayout}</h2>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{c.layoutHint}</p>
                  {layoutItems.length === 0 ? (
                    <div className="mt-4 text-sm text-[var(--text-muted)]">{c.layoutEmpty}</div>
                  ) : (
                    <ol className="mt-3 space-y-1.5">
                      {layoutItems.map((it, idx) => (
                        <li
                          key={`${it.source}:${it.id}`}
                          className="flex items-center justify-between rounded-xl border border-theme bg-[var(--surface-2)] px-3 py-2"
                        >
                          <span className="flex items-center gap-2 text-sm">
                            <span className="text-xs text-[var(--text-muted)]">{idx + 1}.</span>
                            {it.label}
                            <span className="rounded bg-[var(--surface-3)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
                              {it.source === 'native' ? c.sourceNative : c.sourceCustom}
                            </span>
                          </span>
                          <span className="flex gap-1">
                            <button
                              className="btn btn-secondary btn-sm"
                              disabled={idx === 0}
                              title={c.moveUp}
                              onClick={() => moveLayout(idx, -1)}
                            >
                              ▲
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              disabled={idx === layoutItems.length - 1}
                              title={c.moveDown}
                              onClick={() => moveLayout(idx, 1)}
                            >
                              ▼
                            </button>
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
