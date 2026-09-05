'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '../../api-client'
import { useSettings } from '../../settings-context'
import { toast } from '../../toast'

type FieldType = 'STRING' | 'NUMBER' | 'CURRENCY' | 'DATE' | 'BOOLEAN' | 'SELECT' | 'RELATION'
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
  relationEntity: string | null
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
    searchObjects: 'Buscar objeto…',
    searchFields: 'Buscar campo…',
    native: 'Campos nativos',
    nativeHint: 'Definidos pela aplicação. Ajuste o rótulo mostrado ao usuário; o que aparece na tela e em que ordem é definido na aba Layout.',
    relations: 'Relacionamentos',
    custom: 'Campos personalizados',
    system: 'sistema',
    required: 'Obrigatório',
    optional: 'Opcional',
    list: 'lista',
    field: 'Campo',
    colName: 'Nome',
    type: 'Tipo',
    active: 'Ativo',
    rotulo: 'Rótulo (tela do usuário)',
    labelPlaceholder: 'Padrão',
    tabFields: 'Campos',
    tabRelations: 'Relações',
    tabLayout: 'Layout',
    layoutHint: 'O que aparece na tela do usuário e em que ordem. Em breve com arrastar e soltar.',
    layoutShown: 'Na tela do usuário',
    layoutAvailable: 'Campos disponíveis',
    layoutAvailableHint: 'Adicione para mostrar na tela do usuário.',
    layoutEmpty: 'Nenhum campo na tela. Adicione da lista abaixo.',
    availableEmpty: 'Todos os campos já estão na tela.',
    addToLayout: 'Adicionar',
    removeFromLayout: 'Remover',
    moveUp: 'Subir',
    moveDown: 'Descer',
    sourceNative: 'nativo',
    sourceCustom: 'personalizado',
    relFrom: 'Campo',
    relTo: 'Aponta para',
    add: 'Adicionar campo',
    newField: 'Novo campo',
    editTitle: 'Editar campo',
    label: 'Nome do campo',
    help: 'Texto de ajuda',
    options: 'Opções (uma por linha)',
    relatedObject: 'Objeto relacionado',
    relatedObjectHint: 'O campo aponta para um registro deste objeto.',
    relationNeedsTarget: 'Escolha o objeto relacionado.',
    relationLocked: 'Campo com valores — não dá para trocar o objeto relacionado.',
    edit: 'Editar',
    save: 'Salvar',
    cancel: 'Cancelar',
    remove: 'Excluir',
    actions: 'Ações',
    deleteConfirm: 'Excluir este campo personalizado? Esta ação não pode ser desfeita.',
    nativeResetConfirm: 'Remover o rótulo personalizado deste campo e voltar ao padrão?',
    none: 'Nenhum campo personalizado neste objeto.',
    noFieldMatch: 'Nenhum campo corresponde à busca.',
    inUse: (n: number) => `${n} valor(es)`,
    hasValues: 'Campo com valores — desative em vez de excluir.',
    typeLocked: 'Campo com valores — não dá para mudar o tipo.',
    saved: 'Salvo',
    error: 'Não foi possível concluir',
    types: { STRING: 'Texto', NUMBER: 'Número', CURRENCY: 'Moeda', DATE: 'Data', BOOLEAN: 'Sim/Não', SELECT: 'Lista', RELATION: 'Relação' } as Record<FieldType, string>,
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
    searchObjects: 'Buscar objeto…',
    searchFields: 'Buscar campo…',
    native: 'Campos nativos',
    nativeHint: 'Definidos por la aplicación. Ajusta el rótulo visible; qué aparece y en qué orden se define en la pestaña Layout.',
    relations: 'Relaciones',
    custom: 'Campos personalizados',
    system: 'sistema', required: 'Obligatorio', optional: 'Opcional', list: 'lista',
    field: 'Campo', colName: 'Nombre', type: 'Tipo', active: 'Activo',
    add: 'Agregar campo', newField: 'Nuevo campo', editTitle: 'Editar campo', label: 'Nombre del campo', help: 'Texto de ayuda', options: 'Opciones (una por línea)',
    relatedObject: 'Objeto relacionado',
    relatedObjectHint: 'El campo apunta a un registro de este objeto.',
    relationNeedsTarget: 'Elige el objeto relacionado.',
    relationLocked: 'Campo con valores — no se puede cambiar el objeto relacionado.',
    edit: 'Editar', save: 'Guardar', cancel: 'Cancelar', remove: 'Eliminar',
    actions: 'Acciones',
    deleteConfirm: '¿Eliminar este campo personalizado? Esta acción no se puede deshacer.',
    nativeResetConfirm: '¿Quitar el rótulo personalizado de este campo y volver al predeterminado?',
    none: 'No hay campos personalizados en este objeto.',
    noFieldMatch: 'Ningún campo coincide con la búsqueda.',
    inUse: (n: number) => `${n} valor(es)`,
    hasValues: 'Campo con valores — desactívalo en vez de eliminar.',
    typeLocked: 'Campo con valores — no se puede cambiar el tipo.',
    saved: 'Guardado', error: 'No se pudo completar',
    types: { STRING: 'Texto', NUMBER: 'Número', CURRENCY: 'Moneda', DATE: 'Fecha', BOOLEAN: 'Sí/No', SELECT: 'Lista', RELATION: 'Relación' },
    nativeKinds: { text: 'Texto', number: 'Número', currency: 'Moneda', boolean: 'Sí/No', date: 'Fecha/hora', enum: 'Lista fija', json: 'JSON', relation: 'Relación' },
    tabFields: 'Campos', tabRelations: 'Relaciones', tabLayout: 'Layout',
    layoutHint: 'Qué aparece en la pantalla del usuario y en qué orden. Pronto con arrastrar y soltar.',
    layoutShown: 'En la pantalla del usuario',
    layoutAvailable: 'Campos disponibles',
    layoutAvailableHint: 'Agrégalos para mostrarlos en la pantalla del usuario.',
    layoutEmpty: 'Ningún campo en la pantalla. Agrégalo de la lista de abajo.',
    availableEmpty: 'Todos los campos ya están en la pantalla.',
    addToLayout: 'Agregar', removeFromLayout: 'Quitar',
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
    searchObjects: 'Search object…',
    searchFields: 'Search field…',
    native: 'Native fields',
    nativeHint: 'Defined by the application. Adjust the label users see; what shows and in what order is set on the Layout tab.',
    relations: 'Relationships',
    custom: 'Custom fields',
    system: 'system', required: 'Required', optional: 'Optional', list: 'list',
    field: 'Field', colName: 'Name', type: 'Type', active: 'Active',
    add: 'Add field', newField: 'New field', editTitle: 'Edit field', label: 'Field name', help: 'Help text', options: 'Options (one per line)',
    relatedObject: 'Related object',
    relatedObjectHint: 'The field points to a record of this object.',
    relationNeedsTarget: 'Choose the related object.',
    relationLocked: 'Field has values — the related object cannot be changed.',
    edit: 'Edit', save: 'Save', cancel: 'Cancel', remove: 'Delete',
    actions: 'Actions',
    deleteConfirm: 'Delete this custom field? This cannot be undone.',
    nativeResetConfirm: "Remove this field's custom label and revert to the default?",
    none: 'No custom fields on this object.',
    noFieldMatch: 'No field matches the search.',
    inUse: (n: number) => `${n} value(s)`,
    hasValues: 'Field has values — deactivate instead of deleting.',
    typeLocked: 'Field has values — the type cannot be changed.',
    saved: 'Saved', error: 'Could not complete',
    types: { STRING: 'Text', NUMBER: 'Number', CURRENCY: 'Currency', DATE: 'Date', BOOLEAN: 'Yes/No', SELECT: 'List', RELATION: 'Relation' },
    nativeKinds: { text: 'Text', number: 'Number', currency: 'Currency', boolean: 'Yes/No', date: 'Date/time', enum: 'Fixed list', json: 'JSON', relation: 'Relation' },
    tabFields: 'Fields', tabRelations: 'Relationships', tabLayout: 'Layout',
    layoutHint: 'What shows on the user screen and in what order. Drag & drop coming soon.',
    layoutShown: 'On the user screen',
    layoutAvailable: 'Available fields',
    layoutAvailableHint: 'Add them to show on the user screen.',
    layoutEmpty: 'No fields on the screen. Add one from the list below.',
    availableEmpty: 'Every field is already on the screen.',
    addToLayout: 'Add', removeFromLayout: 'Remove',
    sourceNative: 'native', sourceCustom: 'custom', relFrom: 'Field', relTo: 'Points to', moveUp: 'Move up', moveDown: 'Move down',
  }
  return language === 'pt' ? pt : language === 'es' ? es : en
}

const inputCls = 'h-10 w-full rounded-md border border-theme bg-transparent px-3 text-sm'
const CUSTOM_TYPES: FieldType[] = ['STRING', 'NUMBER', 'CURRENCY', 'DATE', 'BOOLEAN', 'SELECT', 'RELATION']

type SortState = { key: string; dir: 'asc' | 'desc' }

function cmpVals(a: string | number, b: string | number) {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

function SortTh({ label, col, sort, onSort, className }: { label: string; col: string; sort: SortState; onSort: (c: string) => void; className?: string }) {
  const active = sort.key === col
  return (
    <th className={`px-2 py-1.5 ${className ?? ''}`}>
      <button type="button" className="inline-flex items-center gap-1 uppercase hover:text-[var(--foreground)]" onClick={() => onSort(col)}>
        {label}
        <span className="text-[10px] opacity-60">{active ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  )
}

export default function ObjectsManager() {
  const { language } = useSettings()
  const c = tr(language)
  const qc = useQueryClient()
  const lbl = (l: Labels) => (language === 'pt' ? l.pt : language === 'es' ? l.es : l.en)
  const objName = (o: { configuredLabel: string | null; labels: Labels }) => o.configuredLabel || lbl(o.labels)

  const listQ = useQuery({ queryKey: ['admin-objects'], queryFn: () => api<{ objects: ObjectRow[] }>('/api/admin/objects'), retry: false })
  const [entity, setEntity] = useState<string>('')
  const [objectQuery, setObjectQuery] = useState('')

  const objects = useMemo(
    () => [...(listQ.data?.objects ?? [])].sort((a, b) => objName(a).localeCompare(objName(b), language)),
    [listQ.data, language],
  )
  const selected = entity || objects[0]?.key || ''
  const objNameByKey = useMemo(() => new Map(objects.map((o) => [o.key, objName(o)])), [objects, language])
  const relationTargets = useMemo(() => objects.filter((o) => o.key !== selected), [objects, selected])
  const visibleObjects = useMemo(() => {
    const q = objectQuery.trim().toLowerCase()
    if (!q) return objects
    return objects.filter((o) => objName(o).toLowerCase().includes(q) || o.key.toLowerCase().includes(q))
  }, [objects, objectQuery, language])

  const detailQ = useQuery({
    queryKey: ['admin-object', selected],
    enabled: !!selected,
    queryFn: () => api<Detail>(`/api/admin/objects/${selected}`),
  })

  const [tab, setTab] = useState<'fields' | 'relations' | 'layout'>('fields')
  const [fieldQuery, setFieldQuery] = useState('')
  const [nativeSort, setNativeSort] = useState<SortState>({ key: 'label', dir: 'asc' })
  const [customSort, setCustomSort] = useState<SortState>({ key: 'label', dir: 'asc' })
  const [editingNative, setEditingNative] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [fLabel, setFLabel] = useState('')
  const [fType, setFType] = useState<FieldType>('STRING')
  const [fRequired, setFRequired] = useState(false)
  const [fActive, setFActive] = useState(true)
  const [fHelp, setFHelp] = useState('')
  const [fOptions, setFOptions] = useState('')
  const [fRelationEntity, setFRelationEntity] = useState('')

  function sortToggle(setter: (fn: (s: SortState) => SortState) => void) {
    return (col: string) => setter((s) => (s.key === col ? { key: col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: col, dir: 'asc' }))
  }

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['admin-object', selected] })
    void qc.invalidateQueries({ queryKey: ['admin-objects'] })
  }

  function resetForm() {
    setEditingId(null)
    setFLabel(''); setFType('STRING'); setFRequired(false); setFActive(true); setFHelp(''); setFOptions(''); setFRelationEntity('')
  }
  function openNew() {
    resetForm()
    setModalOpen(true)
  }
  function startEdit(f: CustomDef) {
    setEditingId(f.id)
    setFLabel(f.label)
    setFType(f.type)
    setFRequired(f.required)
    setFActive(f.active)
    setFHelp(f.helpText ?? '')
    setFOptions(f.options.join('\n'))
    setFRelationEntity(f.relationEntity ?? '')
    setModalOpen(true)
  }
  function closeModal() {
    setModalOpen(false)
    resetForm()
  }

  const optionsArr = () => fOptions.split('\n').map((s) => s.trim()).filter(Boolean)
  const formInvalid =
    !fLabel.trim() ||
    (fType === 'SELECT' && optionsArr().length < 2) ||
    (fType === 'RELATION' && !fRelationEntity)

  const saveM = useMutation({
    mutationFn: () => {
      const payload = {
        label: fLabel.trim(),
        type: fType,
        required: fRequired,
        helpText: fHelp.trim() || null,
        options: fType === 'SELECT' ? optionsArr() : [],
        relationEntity: fType === 'RELATION' ? fRelationEntity : null,
      }
      return editingId
        ? api(`/api/admin/custom-fields/${editingId}`, { method: 'PATCH', body: JSON.stringify({ ...payload, active: fActive }) })
        : api('/api/admin/custom-fields', { method: 'POST', body: JSON.stringify({ ...payload, entity: selected }) })
    },
    onSuccess: () => {
      toast.success(c.saved)
      closeModal()
      invalidate()
    },
    onError: (e: any) => {
      const m = String(e?.message ?? '')
      toast.error(
        m.includes('TYPE_LOCKED_WITH_VALUES')
          ? c.typeLocked
          : m.includes('RELATION_LOCKED_WITH_VALUES')
            ? c.relationLocked
            : m.includes('RELATION_NEEDS_TARGET') || m.includes('RELATION_SELF')
              ? c.relationNeedsTarget
              : c.error,
      )
    },
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
    onError: () => toast.error(c.error),
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

  const fieldMatch = (q: string, ...parts: string[]) => {
    const s = q.trim().toLowerCase()
    return !s || parts.some((p) => p.toLowerCase().includes(s))
  }

  const nativeRows = useMemo(() => {
    if (!d) return []
    const val = (f: NativeField): string | number =>
      nativeSort.key === 'name' ? f.name : nativeSort.key === 'type' ? c.nativeKinds[f.kind] : f.label.toLowerCase()
    return d.native.scalars
      .filter((f) => fieldMatch(fieldQuery, f.name, f.label, f.defaultLabel))
      .sort((a, b) => (nativeSort.dir === 'asc' ? 1 : -1) * cmpVals(val(a), val(b)))
  }, [d, fieldQuery, nativeSort, c])

  const customRows = useMemo(() => {
    if (!d) return []
    const val = (f: CustomDef): string | number =>
      customSort.key === 'key' ? f.key : customSort.key === 'type' ? c.types[f.type] : f.label.toLowerCase()
    return d.custom
      .filter((f) => fieldMatch(fieldQuery, f.key, f.label))
      .sort((a, b) => (customSort.dir === 'asc' ? 1 : -1) * cmpVals(val(a), val(b)))
  }, [d, fieldQuery, customSort, c])

  // Layout: campos que aparecem na tela do usuário (ordenados) + os disponíveis para adicionar.
  type LayoutItem = { source: 'native' | 'custom'; id: string; label: string; order: number }
  const layoutItems: LayoutItem[] = useMemo(() => {
    if (!d) return []
    const items: LayoutItem[] = [
      ...d.native.scalars.filter((f) => f.visible).map((f) => ({ source: 'native' as const, id: f.name, label: f.label, order: f.order })),
      ...d.custom.filter((f) => f.active).map((f) => ({ source: 'custom' as const, id: f.id, label: f.label, order: f.order })),
    ]
    return items.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
  }, [d])

  const availableItems: LayoutItem[] = useMemo(() => {
    if (!d) return []
    const items: LayoutItem[] = [
      ...d.native.scalars
        .filter((f) => !f.visible && !f.system)
        .map((f) => ({ source: 'native' as const, id: f.name, label: f.label, order: f.order })),
      ...d.custom.filter((f) => !f.active).map((f) => ({ source: 'custom' as const, id: f.id, label: f.label, order: f.order })),
    ]
    return items.sort((a, b) => a.label.localeCompare(b.label))
  }, [d])

  function setShownOnScreen(it: LayoutItem, shown: boolean, order?: number) {
    if (it.source === 'native') nativeCfgM.mutate({ fieldName: it.id, data: { visible: shown, ...(order != null ? { order } : {}) } })
    else patchM.mutate({ id: it.id, data: { active: shown, ...(order != null ? { order } : {}) } })
  }

  function moveLayout(index: number, dir: -1 | 1) {
    const next = [...layoutItems]
    const j = index + dir
    if (j < 0 || j >= next.length) return
    ;[next[index], next[j]] = [next[j], next[index]]
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
          <input
            className="mb-2 h-9 w-full rounded-lg border border-theme bg-transparent px-3 text-sm"
            placeholder={c.searchObjects}
            value={objectQuery}
            onChange={(e) => setObjectQuery(e.target.value)}
          />
          {visibleObjects.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => {
                setEntity(o.key)
                resetForm()
                setFieldQuery('')
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
          {visibleObjects.length === 0 ? <div className="px-2 py-3 text-xs text-[var(--text-muted)]">{c.noFieldMatch}</div> : null}
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

              <div className="flex items-center gap-2">
                <input
                  className="h-9 w-full max-w-xs rounded-lg border border-theme bg-transparent px-3 text-sm"
                  placeholder={c.searchFields}
                  value={fieldQuery}
                  onChange={(e) => setFieldQuery(e.target.value)}
                />
                <button type="button" className="btn btn-primary btn-sm ml-auto whitespace-nowrap" onClick={openNew}>
                  + {c.newField}
                </button>
              </div>

              <section className="surface rounded-2xl border border-theme p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">{c.native}</h2>
                  <span className="text-xs text-[var(--text-muted)]">{nativeRows.length}/{d.native.scalars.length}</span>
                </div>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{c.nativeHint}</p>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-theme text-left text-xs tracking-wide text-[var(--text-muted)]">
                        <SortTh label={c.field} col="name" sort={nativeSort} onSort={sortToggle(setNativeSort)} />
                        <SortTh label={c.rotulo} col="label" sort={nativeSort} onSort={sortToggle(setNativeSort)} />
                        <SortTh label={c.type} col="type" sort={nativeSort} onSort={sortToggle(setNativeSort)} />
                        <th className="px-2 py-1.5 text-right text-xs uppercase">{c.actions}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nativeRows.map((f) => {
                        const editing = editingNative === f.name
                        return (
                        <tr key={f.name} className={`border-b border-theme/50 ${editing ? 'bg-[var(--surface-2)]' : ''}`}>
                          <td className={`px-2 py-1.5 ${f.system ? 'text-[var(--text-muted)]' : ''}`}>
                            <code>{f.name}</code>
                            {f.system ? <span className="ml-2 rounded bg-[var(--surface-3)] px-1.5 py-0.5 text-[10px]">{c.system}</span> : null}
                            {f.list ? <span className="ml-1 text-xs">[{c.list}]</span> : null}
                          </td>
                          <td className="px-2 py-1.5">
                            {editing ? (
                              <input
                                autoFocus
                                className="h-8 w-44 rounded border border-theme bg-transparent px-2 text-sm"
                                defaultValue={f.configuredLabel ?? ''}
                                placeholder={f.defaultLabel}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                                  if (e.key === 'Escape') setEditingNative(null)
                                }}
                                onBlur={(e) => {
                                  const v = e.target.value.trim()
                                  if (v !== (f.configuredLabel ?? '')) nativeCfgM.mutate({ fieldName: f.name, data: { label: v || null } })
                                  setEditingNative(null)
                                }}
                              />
                            ) : (
                              <span className={f.configuredLabel ? '' : 'text-[var(--text-muted)]'}>
                                {f.label}
                                {f.configuredLabel ? null : <span className="ml-1 text-[10px]">({c.labelPlaceholder})</span>}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-[var(--text-muted)]">{c.nativeKinds[f.kind]}</td>
                          <td className="px-2 py-1.5">
                            <div className="flex justify-end gap-1">
                              {editing ? (
                                <button className="btn btn-secondary btn-sm" onClick={() => setEditingNative(null)}>
                                  {c.cancel}
                                </button>
                              ) : (
                                <button className="btn btn-secondary btn-sm" onClick={() => setEditingNative(f.name)}>
                                  {c.edit}
                                </button>
                              )}
                              <button
                                className="btn btn-danger-soft btn-sm"
                                disabled={!f.configuredLabel || nativeCfgM.isPending}
                                title={!f.configuredLabel ? c.labelPlaceholder : undefined}
                                onClick={() => {
                                  if (!window.confirm(c.nativeResetConfirm)) return
                                  setEditingNative(null)
                                  nativeCfgM.mutate({ fieldName: f.name, data: { label: null } })
                                }}
                              >
                                {c.remove}
                              </button>
                            </div>
                          </td>
                        </tr>
                        )
                      })}
                      {nativeRows.length === 0 ? (
                        <tr><td colSpan={4} className="px-2 py-4 text-center text-[var(--text-muted)]">{c.noFieldMatch}</td></tr>
                      ) : null}
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
                      <tr className="border-b border-theme text-left text-xs tracking-wide text-[var(--text-muted)]">
                        <SortTh label={c.rotulo} col="label" sort={customSort} onSort={sortToggle(setCustomSort)} />
                        <SortTh label={c.colName} col="key" sort={customSort} onSort={sortToggle(setCustomSort)} />
                        <SortTh label={c.type} col="type" sort={customSort} onSort={sortToggle(setCustomSort)} />
                        <th className="px-2 py-1.5 text-right text-xs uppercase">{c.actions}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.custom.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-2 py-4 text-center text-[var(--text-muted)]">
                            {c.none}
                          </td>
                        </tr>
                      ) : customRows.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-2 py-4 text-center text-[var(--text-muted)]">
                            {c.noFieldMatch}
                          </td>
                        </tr>
                      ) : (
                        customRows.map((f) => (
                          <tr key={f.id} className={`border-b border-theme/50 ${f.active ? '' : 'opacity-50'} ${editingId === f.id ? 'bg-[var(--surface-2)]' : ''}`}>
                            <td className="px-2 py-1.5 font-medium">
                              {f.label}
                              {f.required ? <span className="ml-1 text-[var(--danger,#c00)]">*</span> : null}
                            </td>
                            <td className="px-2 py-1.5 text-[var(--text-muted)]">
                              <code>{f.key}</code>
                              {f._count.values ? <span className="text-xs"> · {c.inUse(f._count.values)}</span> : null}
                            </td>
                            <td className="px-2 py-1.5 text-[var(--text-muted)]">
                              {c.types[f.type]}
                              {f.type === 'RELATION' && f.relationEntity ? (
                                <span className="text-xs"> → {objNameByKey.get(f.relationEntity) ?? f.relationEntity}</span>
                              ) : null}
                            </td>
                            <td className="px-2 py-1.5">
                              <div className="flex justify-end gap-1">
                                <button className="btn btn-secondary btn-sm" onClick={() => startEdit(f)}>
                                  {c.edit}
                                </button>
                                <button
                                  className="btn btn-danger-soft btn-sm"
                                  disabled={f._count.values > 0 || delM.isPending}
                                  title={f._count.values > 0 ? c.hasValues : undefined}
                                  onClick={() => {
                                    if (!window.confirm(c.deleteConfirm)) return
                                    delM.mutate(f.id)
                                  }}
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

                  <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{c.layoutShown}</div>
                  {layoutItems.length === 0 ? (
                    <div className="mt-2 text-sm text-[var(--text-muted)]">{c.layoutEmpty}</div>
                  ) : (
                    <ol className="mt-2 space-y-1.5">
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
                            <button className="btn btn-secondary btn-sm" disabled={idx === 0} title={c.moveUp} onClick={() => moveLayout(idx, -1)}>▲</button>
                            <button className="btn btn-secondary btn-sm" disabled={idx === layoutItems.length - 1} title={c.moveDown} onClick={() => moveLayout(idx, 1)}>▼</button>
                            <button className="btn btn-danger-soft btn-sm" title={c.removeFromLayout} onClick={() => setShownOnScreen(it, false)}>✕</button>
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}

                  <div className="mt-5 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{c.layoutAvailable}</div>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{c.layoutAvailableHint}</p>
                  {availableItems.length === 0 ? (
                    <div className="mt-2 text-sm text-[var(--text-muted)]">{c.availableEmpty}</div>
                  ) : (
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {availableItems.map((it) => (
                        <li key={`${it.source}:${it.id}`}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setShownOnScreen(it, true, layoutItems.length)}
                          >
                            + {it.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ) : null}
            </>
          )}
        </div>
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} />
          <div className="surface modal-safe absolute bottom-0 left-0 right-0 mx-auto w-full max-w-xl rounded-t-2xl border border-theme p-5 shadow-xl sm:bottom-auto sm:top-20 sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-lg font-semibold">
                {editingId ? c.editTitle : c.newField}
                <span className="ml-2 text-sm font-normal text-[var(--text-muted)]">{objNameByKey.get(selected) ?? selected}</span>
              </h2>
              <button className="btn btn-secondary btn-sm" onClick={closeModal}>
                {c.cancel}
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium">
                {c.label}
                <input className={`${inputCls} mt-1`} value={fLabel} onChange={(e) => setFLabel(e.target.value)} autoFocus />
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

              {fType === 'RELATION' ? (
                <label className="text-xs font-medium sm:col-span-2">
                  {c.relatedObject}
                  <select className={`${inputCls} mt-1`} value={fRelationEntity} onChange={(e) => setFRelationEntity(e.target.value)}>
                    <option value="">—</option>
                    {relationTargets.map((o) => (
                      <option key={o.key} value={o.key}>
                        {objName(o)}
                      </option>
                    ))}
                  </select>
                  <span className="mt-0.5 block font-normal text-[var(--text-muted)]">{c.relatedObjectHint}</span>
                </label>
              ) : null}

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
                  <textarea
                    className="mt-1 w-full rounded-md border border-theme bg-transparent px-3 py-2 text-sm"
                    rows={3}
                    value={fOptions}
                    onChange={(e) => setFOptions(e.target.value)}
                  />
                </label>
              ) : null}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button className="btn btn-secondary btn-sm" onClick={closeModal}>
                {c.cancel}
              </button>
              <button className="btn btn-primary btn-sm" disabled={saveM.isPending || formInvalid} onClick={() => saveM.mutate()}>
                {editingId ? c.save : c.add}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
