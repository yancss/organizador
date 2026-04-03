'use client'

import { useEffect, useMemo, useState } from 'react'

type CountryCode = 'BR' | 'PT' | 'ES'

type TaxIdType = 'CNPJ' | 'CPF' | 'NIF' | 'CIF'

type BrEnv = 'HOMOLOGATION' | 'PRODUCTION'

type Company = {
  id: string
  legalName: string
  tradeName: string | null
  country: CountryCode
}

type Branch = {
  id: string
  code: string
  country: CountryCode
  taxIdType: TaxIdType
  taxId: string

  brIe: string | null
  brCrt: number | null
  brNfeSeries: string | null
  brNfeNextNumber: number | null
  brNfeEnvironment: BrEnv | null

  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  postalCode: string | null
}

export default function FiscalPanel() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [company, setCompany] = useState<Company | null>(null)
  const [hq, setHq] = useState<Branch | null>(null)

  const hasBr = (hq?.country ?? company?.country) === 'BR'

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/admin/fiscal/company', { cache: 'no-store' })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error ?? 'FAILED_TO_LOAD')

        const first = (data?.companies ?? [])[0]
        const firstBranch = first?.branches?.[0]

        if (mounted) {
          setCompany(
            first
              ? { id: first.id, legalName: first.legalName, tradeName: first.tradeName ?? null, country: first.country }
              : {
                  id: '',
                  legalName: '',
                  tradeName: null,
                  country: 'BR',
                },
          )

          setHq(
            firstBranch
              ? {
                  id: firstBranch.id,
                  code: firstBranch.code,
                  country: firstBranch.country,
                  taxIdType: firstBranch.taxIdType,
                  taxId: firstBranch.taxId,

                  brIe: firstBranch.brIe ?? null,
                  brCrt: firstBranch.brCrt ?? null,
                  brNfeSeries: firstBranch.brNfeSeries ?? null,
                  brNfeNextNumber: firstBranch.brNfeNextNumber ?? null,
                  brNfeEnvironment: firstBranch.brNfeEnvironment ?? null,

                  addressLine1: firstBranch.addressLine1 ?? null,
                  addressLine2: firstBranch.addressLine2 ?? null,
                  city: firstBranch.city ?? null,
                  state: firstBranch.state ?? null,
                  postalCode: firstBranch.postalCode ?? null,
                }
              : {
                  id: '',
                  code: 'MATRIZ',
                  country: 'BR',
                  taxIdType: 'CNPJ',
                  taxId: '',

                  brIe: null,
                  brCrt: 1,
                  brNfeSeries: '1',
                  brNfeNextNumber: 1,
                  brNfeEnvironment: 'HOMOLOGATION',

                  addressLine1: null,
                  addressLine2: null,
                  city: null,
                  state: null,
                  postalCode: null,
                },
          )
        }
      } catch (e: any) {
        if (mounted) setError(e?.message ?? 'FAILED_TO_LOAD')
      } finally {
        if (mounted) setLoading(false)
      }
    })()

    return () => {
      mounted = false
    }
  }, [])

  const canSave = useMemo(() => {
    if (!company || !hq) return false
    if (!company.legalName.trim()) return false
    if (!hq.code.trim()) return false
    if (!hq.taxId.trim()) return false
    return true
  }, [company, hq])

  async function save() {
    if (!company || !hq) return

    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/fiscal/company', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          company: {
            id: company.id || undefined,
            legalName: company.legalName,
            tradeName: company.tradeName,
            country: company.country,
          },
          hq: {
            id: hq.id || undefined,
            code: hq.code,
            country: hq.country,
            taxIdType: hq.taxIdType,
            taxId: hq.taxId,

            brIe: hq.brIe,
            brCrt: hq.brCrt,
            brNfeSeries: hq.brNfeSeries,
            brNfeNextNumber: hq.brNfeNextNumber,
            brNfeEnvironment: hq.brNfeEnvironment,

            addressLine1: hq.addressLine1,
            addressLine2: hq.addressLine2,
            city: hq.city,
            state: hq.state,
            postalCode: hq.postalCode,
          },
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'FAILED_TO_SAVE')

      setCompany({
        id: data.company.id,
        legalName: data.company.legalName,
        tradeName: data.company.tradeName ?? null,
        country: data.company.country,
      })

      setHq({
        id: data.hq.id,
        code: data.hq.code,
        country: data.hq.country,
        taxIdType: data.hq.taxIdType,
        taxId: data.hq.taxId,

        brIe: data.hq.brIe ?? null,
        brCrt: data.hq.brCrt ?? null,
        brNfeSeries: data.hq.brNfeSeries ?? null,
        brNfeNextNumber: data.hq.brNfeNextNumber ?? null,
        brNfeEnvironment: data.hq.brNfeEnvironment ?? null,

        addressLine1: data.hq.addressLine1 ?? null,
        addressLine2: data.hq.addressLine2 ?? null,
        city: data.hq.city ?? null,
        state: data.hq.state ?? null,
        postalCode: data.hq.postalCode ?? null,
      })
    } catch (e: any) {
      setError(e?.message ?? 'FAILED_TO_SAVE')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-sm text-[var(--text-muted)]">Carregando…</div>
  }

  if (!company || !hq) {
    return <div className="text-sm text-[var(--text-muted)]">Sem dados.</div>
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Fiscal (esqueleto)</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Cadastro da empresa/filial emissora e país para regras fiscais. (NF-e ainda não integrada.)
        </p>
      </header>

      {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}

      <section className="surface rounded-xl border border-theme p-4">
        <h2 className="text-sm font-semibold">Empresa</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <div className="text-xs text-[var(--muted-foreground)]">Razão social</div>
            <input className="input" value={company.legalName} onChange={(e) => setCompany({ ...company, legalName: e.target.value })} />
          </label>

          <label className="space-y-1">
            <div className="text-xs text-[var(--muted-foreground)]">Nome fantasia (opcional)</div>
            <input className="input" value={company.tradeName ?? ''} onChange={(e) => setCompany({ ...company, tradeName: e.target.value || null })} />
          </label>

          <label className="space-y-1">
            <div className="text-xs text-[var(--muted-foreground)]">País (base)</div>
            <select className="input" value={company.country} onChange={(e) => setCompany({ ...company, country: e.target.value as CountryCode })}>
              <option value="BR">Brasil</option>
              <option value="PT">Portugal</option>
              <option value="ES">Espanha</option>
            </select>
          </label>
        </div>
      </section>

      <section className="surface rounded-xl border border-theme p-4">
        <h2 className="text-sm font-semibold">Filial emissora (MATRIZ)</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <div className="text-xs text-[var(--muted-foreground)]">Código</div>
            <input className="input" value={hq.code} onChange={(e) => setHq({ ...hq, code: e.target.value })} />
          </label>

          <label className="space-y-1">
            <div className="text-xs text-[var(--muted-foreground)]">País (regras fiscais)</div>
            <select className="input" value={hq.country} onChange={(e) => setHq({ ...hq, country: e.target.value as CountryCode })}>
              <option value="BR">Brasil</option>
              <option value="PT">Portugal</option>
              <option value="ES">Espanha</option>
            </select>
          </label>

          <label className="space-y-1">
            <div className="text-xs text-[var(--muted-foreground)]">Tipo do documento</div>
            <select className="input" value={hq.taxIdType} onChange={(e) => setHq({ ...hq, taxIdType: e.target.value as TaxIdType })}>
              <option value="CNPJ">CNPJ</option>
              <option value="CPF">CPF</option>
              <option value="NIF">NIF</option>
              <option value="CIF">CIF</option>
            </select>
          </label>

          <label className="space-y-1">
            <div className="text-xs text-[var(--muted-foreground)]">Documento</div>
            <input className="input" value={hq.taxId} onChange={(e) => setHq({ ...hq, taxId: e.target.value })} />
          </label>
        </div>

        {hasBr ? (
          <div className="mt-4 rounded-lg border border-theme p-3">
            <div className="text-xs font-semibold">Brasil (Simples Nacional) — esqueleto NF-e</div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <div className="text-xs text-[var(--muted-foreground)]">IE (opcional)</div>
                <input className="input" value={hq.brIe ?? ''} onChange={(e) => setHq({ ...hq, brIe: e.target.value || null })} />
              </label>

              <label className="space-y-1">
                <div className="text-xs text-[var(--muted-foreground)]">CRT (padrão 1)</div>
                <input
                  className="input"
                  type="number"
                  value={hq.brCrt ?? 1}
                  onChange={(e) => setHq({ ...hq, brCrt: e.target.value ? Number(e.target.value) : null })}
                />
              </label>

              <label className="space-y-1">
                <div className="text-xs text-[var(--muted-foreground)]">Série NF-e</div>
                <input className="input" value={hq.brNfeSeries ?? ''} onChange={(e) => setHq({ ...hq, brNfeSeries: e.target.value || null })} />
              </label>

              <label className="space-y-1">
                <div className="text-xs text-[var(--muted-foreground)]">Próximo número</div>
                <input
                  className="input"
                  type="number"
                  value={hq.brNfeNextNumber ?? 1}
                  onChange={(e) => setHq({ ...hq, brNfeNextNumber: e.target.value ? Number(e.target.value) : null })}
                />
              </label>

              <label className="space-y-1">
                <div className="text-xs text-[var(--muted-foreground)]">Ambiente</div>
                <select
                  className="input"
                  value={hq.brNfeEnvironment ?? 'HOMOLOGATION'}
                  onChange={(e) => setHq({ ...hq, brNfeEnvironment: e.target.value as BrEnv })}
                >
                  <option value="HOMOLOGATION">Homologação</option>
                  <option value="PRODUCTION">Produção</option>
                </select>
              </label>
            </div>

            <p className="mt-2 text-xs text-[var(--muted-foreground)]">
              Numeração será reservada <strong>apenas na emissão</strong> do documento (recomendado).
            </p>
          </div>
        ) : null}
      </section>

      <div className="flex items-center gap-3">
        <button type="button" className="btn" disabled={!canSave || saving} onClick={save}>
          {saving ? 'Salvando…' : 'Salvar'}
        </button>

        <a className="text-xs text-[var(--muted-foreground)]" href="/docs/SECURITY.md" target="_blank" rel="noreferrer">
          Ver docs/SECURITY.md
        </a>
      </div>
    </div>
  )
}
