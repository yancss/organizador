'use client'

import { useEffect, useMemo, useState } from 'react'

import { PhoneInput } from 'react-international-phone'

import { useDraftStorage } from '../use-draft-storage'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { t } from '../i18n'
import { useSettings } from '../settings-context'
import DataTable from '../ui/data-table'
import FieldLabel from '../ui/field-label'
import { toastCreated, toastUpdated, toastDeleted, toastFailedToSave, toastFailedToDelete, toast } from '../toast'
import { api } from '../api-client'

type Client = {
  id: string
  createdAt?: string
  updatedAt?: string
  createdById?: string | null
  updatedById?: string | null

  name: string

  entityType: 'PERSON' | 'COMPANY'

  roles: Array<'CUSTOMER' | 'SUPPLIER'>

  phone: string | null
  phoneCountry?: string | null
  email?: string | null

  birthDate?: string | null // API returns ISO string

  idType?: string | null
  idNumber?: string | null
  idCountry?: string | null

  addressCountry?: string | null
  addressPostalCode?: string | null
  addressState?: string | null
  addressCity?: string | null
  addressDistrict?: string | null
  addressStreet?: string | null
  addressNumber?: string | null
  addressComplement?: string | null

  address?: string | null
  observations?: string | null
}

type Draft = {
  id?: string

  // PF/PJ
  entityType: 'PERSON' | 'COMPANY'

  name: string

  roles: {
    customer: boolean
    supplier: boolean
  }

  phone: string
  phoneCountry: string
  email: string

  birthDate: string

  // Identification (derived from country + PF/PJ)
  idType: string
  idNumber: string
  idCountry: string

  // Address
  addressCountry: string
  addressPostalCode: string
  addressState: string
  addressCity: string
  addressDistrict: string
  addressStreet: string
  addressNumber: string
  addressComplement: string

  // legacy
  address: string

  observations: string
}

function emptyDraft(): Draft {
  return {
    entityType: 'PERSON',
    name: '',
    roles: { customer: true, supplier: false },
    phone: '',
    phoneCountry: '',
    email: '',
    birthDate: '',
    idType: '',
    idNumber: '',
    idCountry: '',
    addressCountry: 'PT',
    addressPostalCode: '',
    addressState: '',
    addressCity: '',
    addressDistrict: '',
    addressStreet: '',
    addressNumber: '',
    addressComplement: '',
    address: '',
    observations: '',
  }
}

function normalizeIso2(v: string) {
  return (v ?? '').trim().toUpperCase()
}

function digitsOnly(v: string) {
  return (v ?? '').replace(/\D/g, '')
}

function formatCepBr(input: string) {
  const d = digitsOnly(input).slice(0, 8)
  if (d.length <= 5) return d
  return d.slice(0, 5) + '-' + d.slice(5)
}

function formatCpPt(input: string) {
  const d = digitsOnly(input).slice(0, 7)
  if (d.length <= 4) return d
  return d.slice(0, 4) + '-' + d.slice(4)
}

function docMeta(countryIso2: string, entityType: 'PERSON' | 'COMPANY') {
  const c = normalizeIso2(countryIso2)
  if (c === 'BR') {
    if (entityType === 'COMPANY') return { label: 'CNPJ', idType: 'CNPJ', digits: 14 }
    return { label: 'CPF', idType: 'CPF', digits: 11 }
  }
  if (c === 'PT') {
    return { label: 'NIF', idType: 'NIF', digits: 9 }
  }
  return { label: 'Documento fiscal', idType: 'TAX_ID', digits: null as null | number }
}

export default function ClientsPage() {
  const qc = useQueryClient()
  const { language } = useSettings()
  const i = t(language)

  const [isOpen, setIsOpen] = useState(false)
  const [ptFound, setPtFound] = useState(false)
  const [ptOptions, setPtOptions] = useState<Array<{ distrito: string; concelho: string }>>([])

  const [audit, setAudit] = useState<{
    createdAt?: string
    updatedAt?: string
    createdById?: string | null
    updatedById?: string | null
  } | null>(null)

  const draftStore = useDraftStorage<Draft>('draft:clients', emptyDraft)
  const draft = draftStore.value
  const setDraft = draftStore.setValue

  const clientsQ = useQuery({
    queryKey: ['clients'],
    queryFn: () => api<{ clients: Client[] }>('/api/clients'),
  })

  const createM = useMutation({
    mutationFn: (payload: any) =>
      api<{ client: Client }>('/api/clients', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['clients'] })
    },
  })

  const updateM = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Client> }) =>
      api<{ client: Client }>(`/api/clients/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['clients'] })
      await qc.invalidateQueries({ queryKey: ['orders'] })
    },
  })

  const deleteM = useMutation({
    mutationFn: (id: string) => api<{ ok: true }>(`/api/clients/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['clients'] })
      await qc.invalidateQueries({ queryKey: ['orders'] })
    },
  })

  const clients = clientsQ.data?.clients ?? []

  const auditUserIds = useMemo(() => {
    const ids = new Set<string>()
    if (audit?.createdById) ids.add(audit.createdById)
    if (audit?.updatedById) ids.add(audit.updatedById)
    return [...ids]
  }, [audit])

  const auditUsersQ = useQuery({
    queryKey: ['users-lookup', auditUserIds.join(',')],
    enabled: auditUserIds.length > 0,
    queryFn: () => api<{ users: Array<{ id: string; name: string | null; email: string | null }> }>(`/api/users/lookup?ids=${encodeURIComponent(auditUserIds.join(','))}`),
  })

  const auditUsers = useMemo(() => {
    const rows = auditUsersQ.data?.users ?? []
    const map = new Map<string, { name: string | null; email: string | null }>()
    for (const u of rows) map.set(u.id, { name: u.name ?? null, email: u.email ?? null })
    return map
  }, [auditUsersQ.data])

  function renderUserLabel(id?: string | null) {
    if (!id) return '—'
    const u = auditUsers.get(id)
    if (!u) return id
    const label = u.name || u.email || id
    const extra = u.email && u.name ? ` (${u.email})` : ''
    return label + extra
  }

  const addressCountry = useMemo(() => normalizeIso2(draft.addressCountry), [draft.addressCountry])
  const dm = useMemo(() => docMeta(addressCountry, draft.entityType), [addressCountry, draft.entityType])

  // Keep identification derived/sane
  useEffect(() => {
    setDraft((d) => {
      const c = normalizeIso2(d.addressCountry)
      const meta = docMeta(c, d.entityType)
      const nextIdCountry = c || d.idCountry
      const shouldResetDoc = d.idType && d.idType !== meta.idType
      return {
        ...d,
        idCountry: nextIdCountry,
        idType: meta.idType,
        idNumber: shouldResetDoc ? '' : d.idNumber,
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.addressCountry, draft.entityType])

  function openCreate() {
    draftStore.clear()
    setPtFound(false)
    setPtOptions([])
    setAudit(null)
    setIsOpen(true)
  }

  function openEdit(c: Client) {
    const birthDate = c.birthDate ? String(c.birthDate).slice(0, 10) : ''

    const entityType = c.entityType ?? 'PERSON'
    const country = normalizeIso2(c.addressCountry ?? c.idCountry ?? 'PT')

    setAudit({
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      createdById: c.createdById ?? null,
      updatedById: c.updatedById ?? null,
    })

    setDraft({
      id: c.id,
      entityType,
      name: c.name,
      roles: {
        customer: (c.roles ?? []).includes('CUSTOMER'),
        supplier: (c.roles ?? []).includes('SUPPLIER'),
      },

      phone: c.phone ?? '',
      phoneCountry: c.phoneCountry ?? '',
      email: c.email ?? '',

      birthDate,

      idType: c.idType ?? docMeta(country, entityType).idType,
      idNumber: c.idNumber ?? '',
      idCountry: c.idCountry ?? country,

      addressCountry: country,
      addressPostalCode: c.addressPostalCode ?? '',
      addressState: c.addressState ?? '',
      addressCity: c.addressCity ?? '',
      addressDistrict: c.addressDistrict ?? '',
      addressStreet: c.addressStreet ?? '',
      addressNumber: c.addressNumber ?? '',
      addressComplement: c.addressComplement ?? '',

      address: c.address ?? '',
      observations: c.observations ?? '',
    })

    // For edits we don't know if it was auto-found; start unlocked.
    setPtFound(false)
    setPtOptions([])
    setIsOpen(true)
  }

  async function lookupAddress() {
    const country = normalizeIso2(draft.addressCountry)

    if (country === 'BR') {
      const cep = digitsOnly(draft.addressPostalCode)
      if (cep.length !== 8) return

      try {
        const r = await api<any>(`/api/address/br?cep=${encodeURIComponent(cep)}`)
        if (!r?.found) return

        setDraft((d) => ({
          ...d,
          addressPostalCode: formatCepBr(d.addressPostalCode),
          addressState: r.state ?? d.addressState,
          addressCity: r.city ?? d.addressCity,
          addressDistrict: r.district ?? d.addressDistrict,
          addressStreet: r.street ?? d.addressStreet,
          addressComplement: r.complement ?? d.addressComplement,
        }))
      } catch {
        // silent (user can fill manually)
      }

      return
    }

    if (country === 'PT') {
      const cp = formatCpPt(draft.addressPostalCode)
      if (!/^\d{4}-\d{3}$/.test(cp)) return

      try {
        const r = await api<any>(`/api/address/pt?cp=${encodeURIComponent(cp)}`)
        if (!r?.found) {
          setPtFound(false)
          setPtOptions([])
          return
        }

        const options = Array.isArray(r.options) ? r.options : []
        setPtFound(true)
        setPtOptions(options.map((o: any) => ({ distrito: String(o.distrito), concelho: String(o.concelho) })))

        if (options.length === 1) {
          setDraft((d) => ({
            ...d,
            addressPostalCode: cp,
            addressState: String(options[0].distrito ?? ''),
            addressCity: String(options[0].concelho ?? ''),
          }))
        } else {
          // Multiple concelhos: set distrito if all same; let user pick concelho
          const ds = Array.from(new Set(options.map((o: any) => String(o.distrito ?? '')))).filter(
            (x): x is string => Boolean(x),
          )
          setDraft((d) => ({
            ...d,
            addressPostalCode: cp,
            addressState: ds.length === 1 ? ds[0]! : d.addressState,
          }))
        }
      } catch {
        setPtFound(false)
        setPtOptions([])
      }
    }
  }

  async function save() {
    const name = draft.name.trim()
    if (!name) {
      toast.error(
        language === 'pt' ? 'Nome é obrigatório.' : language === 'es' ? 'El nombre es obligatorio.' : 'Name is required.',
      )
      return
    }

    const country = normalizeIso2(draft.addressCountry)
    if (country !== 'PT' && country !== 'BR') {
      toast.error(
        language === 'pt'
          ? 'País é obrigatório (PT ou BR).'
          : language === 'es'
            ? 'El país es obligatorio (PT o BR).'
            : 'Country is required (PT or BR).',
      )
      return
    }

    const contactOk = !!draft.phone.trim() || !!draft.email.trim()
    if (!contactOk) {
      toast.error(
        language === 'pt'
          ? 'Informe telefone ou email.'
          : language === 'es'
            ? 'Indique teléfono o email.'
            : 'Provide phone or email.',
      )
      return
    }

    const postal = country === 'BR' ? digitsOnly(draft.addressPostalCode) : formatCpPt(draft.addressPostalCode)
    if (country === 'BR' && postal.length !== 8) {
      toast.error(language === 'pt' ? 'CEP inválido.' : language === 'es' ? 'CEP inválido.' : 'Invalid ZIP code.')
      return
    }
    if (country === 'PT' && !/^\d{4}-\d{3}$/.test(postal)) {
      toast.error(
        language === 'pt' ? 'Código postal inválido.' : language === 'es' ? 'Código postal inválido.' : 'Invalid postal code.',
      )
      return
    }

    const doc = digitsOnly(draft.idNumber)
    if (!doc) {
      toast.error(
        language === 'pt'
          ? `${dm.label} é obrigatório.`
          : language === 'es'
            ? `${dm.label} es obligatorio.`
            : `${dm.label} is required.`,
      )
      return
    }
    if (dm.digits && doc.length !== dm.digits) {
      toast.error(
        language === 'pt'
          ? `${dm.label} deve ter ${dm.digits} dígitos.`
          : language === 'es'
            ? `${dm.label} debe tener ${dm.digits} dígitos.`
            : `${dm.label} must have ${dm.digits} digits.`,
      )
      return
    }

    // If PT was found and locked, ensure we have distrito+concelho
    if (country === 'PT' && ptFound) {
      if (!draft.addressState.trim() || !draft.addressCity.trim()) {
        toast.error(
          language === 'pt'
            ? 'Distrito e Concelho são obrigatórios.'
            : language === 'es'
              ? 'Distrito y municipio son obligatorios.'
              : 'District and council are required.',
        )
        return
      }
    }

    const roles: Array<'CUSTOMER' | 'SUPPLIER'> = []
    if (draft.roles.customer) roles.push('CUSTOMER')
    if (draft.roles.supplier) roles.push('SUPPLIER')
    if (!roles.length) roles.push('CUSTOMER')

    const payload = {
      name,
      entityType: draft.entityType,
      roles,

      phone: draft.phone.trim() ? draft.phone.trim() : null,
      phoneCountry: draft.phoneCountry.trim() ? draft.phoneCountry.trim() : null,
      email: draft.email.trim() ? draft.email.trim() : null,

      birthDate: draft.birthDate.trim() ? draft.birthDate.trim() : null,

      idType: dm.idType,
      idNumber: doc,
      idCountry: country,

      addressCountry: country,
      addressPostalCode: country === 'BR' ? postal : postal,
      addressState: draft.addressState.trim() ? draft.addressState.trim() : null,
      addressCity: draft.addressCity.trim() ? draft.addressCity.trim() : null,
      addressDistrict: draft.addressDistrict.trim() ? draft.addressDistrict.trim() : null,
      addressStreet: draft.addressStreet.trim() ? draft.addressStreet.trim() : null,
      addressNumber: draft.addressNumber.trim() ? draft.addressNumber.trim() : null,
      addressComplement: draft.addressComplement.trim() ? draft.addressComplement.trim() : null,

      address: draft.address.trim() ? draft.address.trim() : null,
      observations: draft.observations.trim() ? draft.observations.trim() : null,
    }

    try {
      if (draft.id) {
        await updateM.mutateAsync({ id: draft.id, payload })
        toastUpdated(i, 'client')
      } else {
        await createM.mutateAsync(payload)
        toastCreated(i, 'client')
      }

      setIsOpen(false)
      draftStore.clear()
      setPtFound(false)
      setPtOptions([])
    } catch (e: any) {
      toastFailedToSave(i, String(e?.message ?? ''))
    }
  }

  async function remove() {
    if (!draft.id) return
    if (!confirm(i.clients.deleteConfirm)) return

    try {
      await deleteM.mutateAsync(draft.id)
      toastDeleted(i, 'client')
      setIsOpen(false)
      draftStore.clear()
      setPtFound(false)
      setPtOptions([])
    } catch (e: any) {
      toastFailedToDelete(i, String(e?.message ?? ''))
    }
  }

  const districtReadOnly = addressCountry === 'PT' && ptFound

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{i.clients.title}</h1>
          <p className="text-sm text-neutral-600">{i.clients.subtitle}</p>
        </div>

        <button className="btn btn-primary" onClick={openCreate} type="button">
          {i.clients.new}
        </button>
      </header>

      {clientsQ.isLoading ? (
        <p className="text-sm text-neutral-600">Carregando…</p>
      ) : clientsQ.isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Erro ao carregar: {String(clientsQ.error)}
        </div>
      ) : (
        <DataTable
          rows={clients}
          empty={i.clients.empty}
          labels={i.table}
          initialSort={{ key: 'name', dir: 'asc' }}
          onRowClick={openEdit}
          columns={[
            {
              key: 'name',
              header: language === 'pt' ? 'Nome' : language === 'es' ? 'Nombre' : 'Name',
              sortValue: (r) => r.name,
              searchValue: (r) => r.name,
              render: (r) => <div className="font-medium text-[var(--foreground)]">{r.name}</div>,
            },
            {
              key: 'phone',
              header: language === 'pt' ? 'Telefone' : language === 'es' ? 'Teléfono' : 'Phone',
              sortValue: (r) => r.phone ?? '',
              searchValue: (r) => r.phone ?? '',
              render: (r) => (
                <div className="text-[var(--muted-foreground)]">{r.phone ? r.phone : i.clients.noPhone}</div>
              ),
            },
            {
              key: 'notes',
              header: language === 'pt' ? 'Obs.' : language === 'es' ? 'Notas' : 'Notes',
              sortValue: (r) => r.observations ?? '',
              searchValue: (r) => r.observations ?? '',
              render: (r) => (
                <div className="max-w-[32ch] truncate text-[var(--muted-foreground)]">{r.observations ?? '—'}</div>
              ),
            },
          ]}
        />
      )}

      {isOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsOpen(false)} />
          <div className="surface modal-safe absolute bottom-0 left-0 right-0 mx-auto w-full max-w-2xl rounded-t-2xl border border-theme p-5 shadow-xl sm:bottom-auto sm:top-20 sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{draft.id ? i.clients.editTitle : i.clients.newTitle}</h2>
                <p className="text-sm text-[var(--text-muted)]">{i.clients.modalSubtitle}</p>
              </div>
              <button
                aria-label="Fechar"
                className="btn btn-secondary btn-icon"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              {draft.id ? (
                <div className="grid gap-2 rounded-lg border border-theme p-3">
                  <div className="text-xs font-medium text-[var(--foreground)]">Controle</div>
                  <div className="grid grid-cols-1 gap-2 text-xs text-[var(--muted-foreground)] sm:grid-cols-2">
                    <div>
                      <span className="text-[var(--foreground)]">{i.common.audit.createdAt}:</span>{' '}
                      {audit?.createdAt ? new Date(audit.createdAt).toLocaleString() : '—'}
                    </div>
                    <div>
                      <span className="text-[var(--foreground)]">{i.common.audit.updatedAt}:</span>{' '}
                      {audit?.updatedAt ? new Date(audit.updatedAt).toLocaleString() : '—'}
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-[var(--foreground)]">{i.common.audit.createdBy}:</span>{' '}
                      {renderUserLabel(audit?.createdById)}
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-[var(--foreground)]">{i.common.audit.updatedBy}:</span>{' '}
                      {renderUserLabel(audit?.updatedById)}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="grid gap-1">
                  <FieldLabel required>{i.clients.entityTypeLabel}</FieldLabel>
                  <select
                    value={draft.entityType}
                    onChange={(e) => setDraft((d) => ({ ...d, entityType: e.target.value as any }))}
                    className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                  >
                    <option value="PERSON">{i.clients.entityTypePerson}</option>
                    <option value="COMPANY">{i.clients.entityTypeCompany}</option>
                  </select>
                </label>

                <label className="grid gap-1">
                  <FieldLabel required>{i.clients.countryLabel}</FieldLabel>
                  <select
                    value={draft.addressCountry}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        addressCountry: normalizeIso2(e.target.value),
                        addressPostalCode: '',
                        addressState: '',
                        addressCity: '',
                        addressDistrict: '',
                        addressStreet: '',
                        addressComplement: '',
                      }))
                    }
                    className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                  >
                    <option value="PT">Portugal</option>
                    <option value="BR">Brasil</option>
                  </select>
                </label>
              </div>

              <label className="grid gap-1">
                <FieldLabel required>{draft.entityType === 'COMPANY' ? (language === 'pt' ? 'Razão social' : 'Legal name') : i.clients.nameLabel}</FieldLabel>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                />
              </label>

              <div className="grid gap-2">
                <div className="text-xs font-medium text-[var(--foreground)]">{language === 'pt' ? 'Vínculo' : language === 'es' ? 'Tipo' : 'Type'}</div>
                <div className="flex flex-wrap gap-4 text-sm text-[var(--foreground)]">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={draft.roles.customer}
                      onChange={(e) => setDraft((d) => ({ ...d, roles: { ...d.roles, customer: e.target.checked } }))}
                    />
                    {language === 'pt' ? 'Cliente' : language === 'es' ? 'Cliente' : 'Customer'}
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={draft.roles.supplier}
                      onChange={(e) => setDraft((d) => ({ ...d, roles: { ...d.roles, supplier: e.target.checked } }))}
                    />
                    {language === 'pt' ? 'Fornecedor' : language === 'es' ? 'Proveedor' : 'Supplier'}
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-[var(--foreground)]">{i.clients.birthDateLabel}</span>
                  <input
                    type="date"
                    value={draft.birthDate}
                    onChange={(e) => setDraft((d) => ({ ...d, birthDate: e.target.value }))}
                    className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                    disabled={draft.entityType === 'COMPANY'}
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-medium text-[var(--foreground)]">{i.clients.phoneLabel}</span>
                  <div className="rounded-lg border border-theme px-3 py-2">
                    <PhoneInput
                      defaultCountry={language === 'pt' ? 'pt' : 'us'}
                      value={draft.phone}
                      onChange={(value, meta) =>
                        setDraft((d) => ({
                          ...d,
                          phone: value,
                          phoneCountry: (meta?.country?.iso2 ?? '').toUpperCase(),
                        }))
                      }
                      inputClassName="w-full bg-transparent outline-none"
                    />
                  </div>
                </label>
              </div>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-[var(--foreground)]">{i.clients.emailLabel}</span>
                <input
                  value={draft.email}
                  onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                  placeholder={i.modal.optional}
                  className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                />
              </label>

              <div className="grid gap-3 rounded-lg border border-theme p-3">
                <div className="text-xs font-medium text-[var(--foreground)]">{i.clients.identificationTitle}</div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <label className="grid gap-1">
                    <span className="text-xs text-[var(--muted-foreground)]">{language === 'pt' ? 'Tipo' : 'Type'}</span>
                    <input
                      value={dm.label}
                      readOnly
                      className="w-full rounded-lg border border-theme bg-transparent px-3 py-2 opacity-80"
                    />
                  </label>

                  <label className="grid gap-1 sm:col-span-2">
                    <span className="text-xs text-[var(--muted-foreground)]">{language === 'pt' ? dm.label : dm.label}</span>
                    <input
                      value={draft.idNumber}
                      onChange={(e) => setDraft((d) => ({ ...d, idNumber: e.target.value }))}
                      placeholder={language === 'pt' ? 'Obrigatório' : 'Required'}
                      className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                      inputMode="numeric"
                    />
                  </label>
                </div>
              </div>

              <div className="grid gap-3 rounded-lg border border-theme p-3">
                <div className="text-xs font-medium text-[var(--foreground)]">{i.clients.addressTitle}</div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <label className="grid gap-1 sm:col-span-2">
                    <FieldLabel required>{i.clients.addressPostalCodeLabel}</FieldLabel>

                    <div className="flex gap-2">
                      <input
                        value={draft.addressPostalCode}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            addressPostalCode:
                              addressCountry === 'BR'
                                ? formatCepBr(e.target.value)
                                : addressCountry === 'PT'
                                  ? formatCpPt(e.target.value)
                                  : e.target.value,
                          }))
                        }
                        onBlur={lookupAddress}
                        placeholder={addressCountry === 'BR' ? '00000-000' : '0000-000'}
                        className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                      />
                      <button
                        className="btn btn-primary whitespace-nowrap"
                        onClick={lookupAddress}
                        type="button"
                      >
                        {i.clients.lookupPostalCode}
                      </button>
                    </div>
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs text-[var(--muted-foreground)]">{i.clients.addressNumberLabel}</span>
                    <input
                      value={draft.addressNumber}
                      onChange={(e) => setDraft((d) => ({ ...d, addressNumber: e.target.value }))}
                      placeholder={i.modal.optional}
                      className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {addressCountry === 'BR' ? i.clients.addressStateLabelBR : addressCountry === 'PT' ? i.clients.addressStateLabelPT : i.clients.addressStateLabel}
                    </span>
                    <input
                      value={draft.addressState}
                      onChange={(e) => setDraft((d) => ({ ...d, addressState: e.target.value }))}
                      placeholder={i.modal.optional}
                      className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                      readOnly={districtReadOnly}
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {addressCountry === 'BR' ? i.clients.addressCityLabelBR : addressCountry === 'PT' ? i.clients.addressCityLabelPT : i.clients.addressCityLabel}
                    </span>
                    {addressCountry === 'PT' && ptFound && ptOptions.length > 1 ? (
                      <select
                        value={draft.addressCity}
                        onChange={(e) => setDraft((d) => ({ ...d, addressCity: e.target.value }))}
                        className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                      >
                        <option value="">{i.clients.selectPlaceholder}</option>
                        {ptOptions.map((o) => (
                          <option key={`${o.distrito}__${o.concelho}`} value={o.concelho}>
                            {o.concelho}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={draft.addressCity}
                        onChange={(e) => setDraft((d) => ({ ...d, addressCity: e.target.value }))}
                        placeholder={i.modal.optional}
                        className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                        readOnly={districtReadOnly}
                      />
                    )}
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {addressCountry === 'BR'
                        ? i.clients.addressDistrictLabelBR
                        : addressCountry === 'PT'
                          ? i.clients.addressDistrictLabelPT
                          : i.clients.addressDistrictLabel}
                    </span>
                    <input
                      value={draft.addressDistrict}
                      onChange={(e) => setDraft((d) => ({ ...d, addressDistrict: e.target.value }))}
                      placeholder={i.modal.optional}
                      className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs text-[var(--muted-foreground)]">{i.clients.addressComplementLabel}</span>
                    <input
                      value={draft.addressComplement}
                      onChange={(e) => setDraft((d) => ({ ...d, addressComplement: e.target.value }))}
                      placeholder={i.modal.optional}
                      className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <label className="grid gap-1 sm:col-span-2">
                    <span className="text-xs text-[var(--muted-foreground)]">{i.clients.addressStreetLabel}</span>
                    <input
                      value={draft.addressStreet}
                      onChange={(e) => setDraft((d) => ({ ...d, addressStreet: e.target.value }))}
                      placeholder={i.modal.optional}
                      className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                    />
                  </label>

                  <div className="hidden sm:block" />
                </div>

                <label className="grid gap-1">
                  <span className="text-xs text-[var(--muted-foreground)]">{i.clients.addressLegacyLabel}</span>
                  <input
                    value={draft.address}
                    onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
                    placeholder={i.modal.optional}
                    className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                  />
                </label>
              </div>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-[var(--foreground)]">{i.clients.observationsLabel}</span>
                <textarea
                  value={draft.observations}
                  onChange={(e) => setDraft((d) => ({ ...d, observations: e.target.value }))}
                  placeholder={i.modal.optional}
                  className="min-h-24 w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                />
              </label>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                className="btn btn-danger-soft"
                onClick={remove}
                type="button"
                disabled={!draft.id || deleteM.isPending}
              >
                {i.clients.delete}
              </button>

              <div className="flex gap-2">
                <button className="btn btn-secondary" onClick={() => setIsOpen(false)} type="button">
                  {i.modal.cancel}
                </button>
                <button
                  className="btn btn-primary"
                  onClick={save}
                  type="button"
                  disabled={!draft.name.trim() || createM.isPending || updateM.isPending}
                >
                  {i.modal.save}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
