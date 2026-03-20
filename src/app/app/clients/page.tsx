'use client'

import { useState } from 'react'

import { PhoneInput } from 'react-international-phone'

import { useDraftStorage } from '../use-draft-storage'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { t } from '../i18n'
import { useSettings } from '../settings-context'
import DataTable from '../ui/data-table'
import FieldLabel from '../ui/field-label'
import { toast, toastCreated, toastUpdated, toastDeleted, toastFailedToSave, toastFailedToDelete } from '../toast'
import { api } from '../api-client'

type Client = {
  id: string
  name: string

  roles: Array<'CUSTOMER' | 'SUPPLIER'>

  phone: string | null
  phoneCountry?: string | null

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

// (moved to api-client.ts)


type Draft = {
  id?: string
  name: string

  roles: {
    customer: boolean
    supplier: boolean
  }

  phone: string
  phoneCountry: string

  birthDate: string

  idType: string
  idNumber: string
  idCountry: string

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
    name: '',
    roles: { customer: true, supplier: false },
    phone: '',
    phoneCountry: '',
    birthDate: '',
    idType: '',
    idNumber: '',
    idCountry: '',
    addressCountry: '',
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

export default function ClientsPage() {
  const qc = useQueryClient()
  const { language } = useSettings()
  const i = t(language)

  const [isOpen, setIsOpen] = useState(false)
  const draftStore = useDraftStorage<Draft>('draft:clients', emptyDraft)
  const draft = draftStore.value
  const setDraft = draftStore.setValue

  const clientsQ = useQuery({
    queryKey: ['clients'],
    queryFn: () => api<{ clients: Client[] }>('/api/clients'),
  })

  const createM = useMutation({
    mutationFn: (payload: {
      name: string
      roles: Array<'CUSTOMER' | 'SUPPLIER'>

      phone: string | null
      phoneCountry: string | null

      birthDate: string | null

      idType: string | null
      idNumber: string | null
      idCountry: string | null

      addressCountry: string | null
      addressPostalCode: string | null
      addressState: string | null
      addressCity: string | null
      addressDistrict: string | null
      addressStreet: string | null
      addressNumber: string | null
      addressComplement: string | null

      address: string | null
      observations: string | null
    }) =>
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

  function openCreate() {
    draftStore.clear()
    setIsOpen(true)
  }

  function openEdit(c: Client) {
    const birthDate = c.birthDate ? String(c.birthDate).slice(0, 10) : ''

    setDraft({
      id: c.id,
      name: c.name,
      roles: {
        customer: (c.roles ?? []).includes('CUSTOMER'),
        supplier: (c.roles ?? []).includes('SUPPLIER'),
      },

      phone: c.phone ?? '',
      phoneCountry: c.phoneCountry ?? '',

      birthDate,

      idType: c.idType ?? '',
      idNumber: c.idNumber ?? '',
      idCountry: c.idCountry ?? '',

      addressCountry: c.addressCountry ?? '',
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
    setIsOpen(true)
  }

  async function save() {
    const name = draft.name.trim()
    if (!name) return

    const roles: Array<'CUSTOMER' | 'SUPPLIER'> = []
    if (draft.roles.customer) roles.push('CUSTOMER')
    if (draft.roles.supplier) roles.push('SUPPLIER')
    if (!roles.length) roles.push('CUSTOMER')

    const payload = {
      name,
      roles,

      phone: draft.phone.trim() ? draft.phone.trim() : null,
      phoneCountry: draft.phoneCountry.trim() ? draft.phoneCountry.trim() : null,

      birthDate: draft.birthDate.trim() ? draft.birthDate.trim() : null,

      idType: draft.idType.trim() ? draft.idType.trim() : null,
      idNumber: draft.idNumber.trim() ? draft.idNumber.trim() : null,
      idCountry: draft.idCountry.trim() ? draft.idCountry.trim() : null,

      addressCountry: draft.addressCountry.trim() ? draft.addressCountry.trim() : null,
      addressPostalCode: draft.addressPostalCode.trim() ? draft.addressPostalCode.trim() : null,
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
    } catch (e: any) {
      toastFailedToDelete(i, String(e?.message ?? ''))
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{i.clients.title}</h1>
          <p className="text-sm text-neutral-600">{i.clients.subtitle}</p>
        </div>

        <button
          className="btn btn-primary"
          onClick={openCreate}
          type="button"
        >
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
                <div className="text-[var(--muted-foreground)]">
                  {r.phone ? r.phone : i.clients.noPhone}
                </div>
              ),
            },
            {
              key: 'notes',
              header: language === 'pt' ? 'Obs.' : language === 'es' ? 'Notas' : 'Notes',
              sortValue: (r) => r.observations ?? '',
              searchValue: (r) => r.observations ?? '',
              render: (r) => (
                <div className="max-w-[32ch] truncate text-[var(--muted-foreground)]">
                  {r.observations ?? '—'}
                </div>
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
              <label className="grid gap-1">
                <FieldLabel required>{i.clients.nameLabel}</FieldLabel>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                />
              </label>

              <div className="grid gap-2">
                <div className="text-xs font-medium text-[var(--foreground)]">{language === 'pt' ? 'Tipo' : language === 'es' ? 'Tipo' : 'Type'}</div>
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
                <span className="text-xs text-[var(--muted-foreground)]">{i.clients.phoneHelp}</span>
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-[var(--foreground)]">{i.clients.birthDateLabel}</span>
                <input
                  type="date"
                  value={draft.birthDate}
                  onChange={(e) => setDraft((d) => ({ ...d, birthDate: e.target.value }))}
                  className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                />
              </label>

              <div className="grid gap-3 rounded-lg border border-theme p-3">
                <div className="text-xs font-medium text-[var(--foreground)]">{i.clients.identificationTitle}</div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <label className="grid gap-1">
                    <span className="text-xs text-[var(--muted-foreground)]">{i.clients.idTypeLabel}</span>
                    <select
                      value={draft.idType}
                      onChange={(e) => setDraft((d) => ({ ...d, idType: e.target.value }))}
                      className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                    >
                      <option value="">{i.clients.idTypeOptional}</option>
                      <option value="TAX_ID">{i.clients.idTypeTaxId}</option>
                      <option value="NATIONAL_ID">{i.clients.idTypeNationalId}</option>
                      <option value="PASSPORT">{i.clients.idTypePassport}</option>
                      <option value="DRIVER_LICENSE">{i.clients.idTypeDriverLicense}</option>
                      <option value="RESIDENCE_PERMIT">{i.clients.idTypeResidencePermit}</option>
                      <option value="COMPANY_ID">{i.clients.idTypeCompanyId}</option>
                      <option value="OTHER">{i.clients.idTypeOther}</option>
                    </select>
                  </label>

                  <label className="grid gap-1 sm:col-span-2">
                    <span className="text-xs text-[var(--muted-foreground)]">{i.clients.idNumberLabel}</span>
                    <input
                      value={draft.idNumber}
                      onChange={(e) => setDraft((d) => ({ ...d, idNumber: e.target.value }))}
                      placeholder={i.modal.optional}
                      className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                    />
                  </label>
                </div>

                <label className="grid gap-1">
                  <span className="text-xs text-[var(--muted-foreground)]">{i.clients.idCountryLabel}</span>
                  <input
                    value={draft.idCountry}
                    onChange={(e) => setDraft((d) => ({ ...d, idCountry: e.target.value.toUpperCase() }))}
                    placeholder="PT / BR"
                    className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                  />
                </label>
              </div>

              <div className="grid gap-3 rounded-lg border border-theme p-3">
                <div className="text-xs font-medium text-[var(--foreground)]">{i.clients.addressTitle}</div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <label className="grid gap-1">
                    <span className="text-xs text-[var(--muted-foreground)]">{i.clients.addressCountryLabel}</span>
                    <input
                      value={draft.addressCountry}
                      onChange={(e) => setDraft((d) => ({ ...d, addressCountry: e.target.value.toUpperCase() }))}
                      placeholder="PT / BR"
                      className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                    />
                  </label>

                  <label className="grid gap-1 sm:col-span-2">
                    <span className="text-xs text-[var(--muted-foreground)]">{i.clients.addressPostalCodeLabel}</span>
                    <input
                      value={draft.addressPostalCode}
                      onChange={(e) => setDraft((d) => ({ ...d, addressPostalCode: e.target.value }))}
                      placeholder={i.modal.optional}
                      className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-xs text-[var(--muted-foreground)]">{i.clients.addressStateLabel}</span>
                    <input
                      value={draft.addressState}
                      onChange={(e) => setDraft((d) => ({ ...d, addressState: e.target.value }))}
                      placeholder={i.modal.optional}
                      className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs text-[var(--muted-foreground)]">{i.clients.addressCityLabel}</span>
                    <input
                      value={draft.addressCity}
                      onChange={(e) => setDraft((d) => ({ ...d, addressCity: e.target.value }))}
                      placeholder={i.modal.optional}
                      className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-xs text-[var(--muted-foreground)]">{i.clients.addressDistrictLabel}</span>
                    <input
                      value={draft.addressDistrict}
                      onChange={(e) => setDraft((d) => ({ ...d, addressDistrict: e.target.value }))}
                      placeholder={i.modal.optional}
                      className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs text-[var(--muted-foreground)]">Complemento</span>
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
                    <span className="text-xs text-[var(--muted-foreground)]">Rua</span>
                    <input
                      value={draft.addressStreet}
                      onChange={(e) => setDraft((d) => ({ ...d, addressStreet: e.target.value }))}
                      placeholder={i.modal.optional}
                      className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs text-[var(--muted-foreground)]">Número</span>
                    <input
                      value={draft.addressNumber}
                      onChange={(e) => setDraft((d) => ({ ...d, addressNumber: e.target.value }))}
                      placeholder={i.modal.optional}
                      className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                    />
                  </label>
                </div>

                <label className="grid gap-1">
                  <span className="text-xs text-[var(--muted-foreground)]">Endereço (texto livre – legado)</span>
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
                <button
                  className="btn btn-secondary"
                  onClick={() => setIsOpen(false)}
                  type="button"
                >
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
