'use client'

import { useEffect, useState } from 'react'
import { Barcode, Plus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { useDraftStorage } from '../use-draft-storage'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { t } from '../i18n'
import { useSettings } from '../settings-context'
import DataTable from '../ui/data-table'
import FieldLabel from '../ui/field-label'
import { toast, toastCreated, toastUpdated, toastDeleted, toastFailedToSave, toastFailedToDelete } from '../toast'
import { api } from '../api-client'
import { AuditHistory } from '../audit-history'

type Product = {
  id: string
  name: string
  brand: string | null
  kind?: 'RAW' | 'INTERMEDIATE' | 'FINISHED'
  unit: string
  avgCost?: string | number | null
  active?: boolean
}

type ProductBarcodeRow = { id: string; code: string; source: string; externalRef: string | null; createdAt: string }

// (moved to api-client.ts)


const UNIT_OPTIONS = ['gr', 'kg', 'ml', 'l', 'un', 'dz']

type Draft = {
  id?: string
  name: string
  brand: string
  kind: 'RAW' | 'INTERMEDIATE' | 'FINISHED'
  unit: string
  pendingBarcodes?: string[]
}

function emptyDraft(): Draft {
  return { name: '', brand: '', kind: 'RAW', unit: 'un', pendingBarcodes: [] }
}

export default function ProductsPage() {
  const qc = useQueryClient()
  const router = useRouter()
  const { language } = useSettings()
  const i = t(language)

  const [isOpen, setIsOpen] = useState(false)
  const draftStore = useDraftStorage<Draft>('draft:products', emptyDraft)
  const draft = draftStore.value
  const setDraft = draftStore.setValue

  const [barcodeInput, setBarcodeInput] = useState('')
  const [scanOpen, setScanOpen] = useState(false)
  const [barcodeAutofillNote, setBarcodeAutofillNote] = useState<string | null>(null)

  function normalizeCode(code: string) {
    return code.trim().replace(/\s+/g, '')
  }

  function inferUnitFromExternal(ex: any): Draft['unit'] | null {
    const raw = String(ex?.productQuantityUnit ?? ex?.quantityText ?? '').toLowerCase()
    if (!raw) return null
    if (raw.includes('kg')) return 'kg'
    if (raw.includes('g') || raw.includes('gr')) return 'gr'
    if (raw.includes('ml')) return 'ml'
    if (raw.includes('l')) return 'l'
    if (raw.includes('un') || raw.includes('unit')) return 'un'
    return null
  }

  async function lookupAndAutofill(code: string) {
    const c = normalizeCode(code)
    if (!c) return
    try {
      const res = await api<any>(`/api/barcodes/lookup?code=${encodeURIComponent(c)}`)
      if (res?.result === 'FOUND_EXTERNAL' && res?.external) {
        const ex = res.external

        setDraft((d) => {
          const next: Draft = { ...d }
          // Fill as much as possible, but do not overwrite user input.
          if (!next.name.trim() && ex.name) next.name = String(ex.name)
          if (!next.brand.trim() && ex.brand) next.brand = String(ex.brand)

          // If new product and still RAW with empty name, external implies a finished retail item.
          if (!next.id && next.kind === 'RAW' && ex.name && !d.name.trim()) {
            next.kind = 'FINISHED'
          }

          const inferred = inferUnitFromExternal(ex)
          if (inferred && (!next.unit || next.unit === 'un')) {
            next.unit = inferred
          }

          return next
        })

        const details = [ex.name, ex.brand, ex.quantityText].filter(Boolean).join(' • ')
        setBarcodeAutofillNote(
          (language === 'pt'
            ? 'Preenchido automaticamente via Open Food Facts'
            : language === 'es'
              ? 'Autocompletado vía Open Food Facts'
              : 'Autofilled via Open Food Facts') + (details ? `: ${details}` : ''),
        )
      } else if (res?.result === 'FOUND_LOCAL') {
        setBarcodeAutofillNote(
          language === 'pt'
            ? 'Este código já está cadastrado e vinculado a um produto.'
            : language === 'es'
              ? 'Este código ya está registrado y vinculado a un producto.'
              : 'This code is already registered and linked to a product.',
        )
      } else {
        setBarcodeAutofillNote(null)
      }
    } catch {
      // ignore lookup errors
    }
  }

  function supportsBarcodeDetector() {
    return typeof window !== 'undefined' && 'BarcodeDetector' in window
  }

  function BarcodeScanModal({
    language,
    onClose,
    onScanned,
  }: {
    language: string
    onClose: () => void
    onScanned: (payload: { code: string }) => void
  }) {
    const [code, setCode] = useState('')
    const [err, setErr] = useState<string | null>(null)
    const [cameraOn, setCameraOn] = useState(false)
    const [cameraErr, setCameraErr] = useState<string | null>(null)

    useEffect(() => {
      if (!cameraOn) return
      if (!supportsBarcodeDetector()) {
        setCameraErr(language === 'pt' ? 'Scanner não suportado neste navegador.' : 'Scanner not supported in this browser.')
        return
      }

      let stream: MediaStream | null = null
      let raf = 0
      const video = document.getElementById('ean-video-product') as HTMLVideoElement | null

      const run = async () => {
        try {
          setCameraErr(null)
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
          if (!video) return
          video.srcObject = stream
          await video.play()

          // @ts-expect-error - BarcodeDetector is a web API
          const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'] })

          const tick = async () => {
            try {
              if (!video || video.readyState < 2) {
                raf = requestAnimationFrame(tick)
                return
              }
              const barcodes = await detector.detect(video)
              const v = (barcodes?.[0]?.rawValue ?? '') as string
              if (v) {
                setCode(v)
                setCameraOn(false)
                onScanned({ code: v })
                return
              }
            } catch {
              // ignore
            }
            raf = requestAnimationFrame(tick)
          }

          raf = requestAnimationFrame(tick)
        } catch (e: any) {
          setCameraErr(String(e?.message ?? e))
        }
      }

      void run()

      return () => {
        if (raf) cancelAnimationFrame(raf)
        if (stream) stream.getTracks().forEach((t) => t.stop())
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cameraOn])

    function submit() {
      const c = normalizeCode(code)
      if (!c) {
        setErr(language === 'pt' ? 'Informe o código.' : 'Enter a code.')
        return
      }
      setErr(null)
      onScanned({ code: c })
    }

    return (
      <div className="fixed inset-0 z-50">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="surface modal-safe absolute bottom-0 left-0 right-0 mx-auto w-full max-w-lg rounded-t-2xl border border-theme p-5 shadow-xl sm:bottom-auto sm:top-24 sm:rounded-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">{language === 'pt' ? 'Escanear EAN' : language === 'es' ? 'Escanear EAN' : 'Scan'}</h2>
              <p className="text-sm text-[var(--text-muted)]">
                {language === 'pt'
                  ? 'Use a câmera (se disponível) ou digite o código.'
                  : language === 'es'
                    ? 'Usa la cámara (si está disponible) o escribe el código.'
                    : 'Use camera (if available) or type the code.'}
              </p>
            </div>
            <button type="button" className="btn btn-secondary btn-icon" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>

          <div className="mt-4 grid gap-3">
            <label className="grid gap-1">
              <span className="text-xs font-medium text-[var(--foreground)]">{language === 'pt' ? 'Código' : language === 'es' ? 'Código' : 'Code'}</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                placeholder={language === 'pt' ? 'EAN' : 'EAN'}
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setCameraOn((v) => !v)}>
                {cameraOn
                  ? language === 'pt'
                    ? 'Desligar câmera'
                    : language === 'es'
                      ? 'Apagar cámara'
                      : 'Stop camera'
                  : language === 'pt'
                    ? 'Usar câmera'
                    : language === 'es'
                      ? 'Usar cámara'
                      : 'Use camera'}
              </button>
              <button type="button" className="btn btn-primary" onClick={submit}>
                {language === 'pt' ? 'Adicionar' : language === 'es' ? 'Agregar' : 'Add'}
              </button>
            </div>

            {cameraOn ? (
              <div className="rounded-xl border border-theme p-2">
                <video id="ean-video-product" className="h-56 w-full rounded-lg bg-black" playsInline muted />
                {cameraErr ? <div className="mt-2 text-xs text-[var(--danger)]">{cameraErr}</div> : null}
              </div>
            ) : null}

            {err ? <div className="text-sm text-[var(--danger)]">{err}</div> : null}
          </div>
        </div>
      </div>
    )
  }

  const productsQ = useQuery({
    queryKey: ['products'],
    queryFn: () => api<{ products: Product[] }>('/api/products'),
  })

  const barcodesQ = useQuery({
    queryKey: ['productBarcodes', draft.id],
    enabled: !!draft.id && isOpen,
    queryFn: () => api<{ barcodes: ProductBarcodeRow[] }>(`/api/products/${draft.id}/barcodes`),
  })

  const createM = useMutation({
    mutationFn: (payload: { name: string; brand: string | null; kind: 'RAW' | 'INTERMEDIATE' | 'FINISHED'; unit: string }) =>
      api<{ product: Product }>('/api/products', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['products'] })
    },
  })

  const updateM = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Product> }) =>
      api<{ product: Product }>(`/api/products/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['products'] })
      await qc.invalidateQueries({ queryKey: ['inventory'] })
    },
  })

  const deleteM = useMutation({
    mutationFn: (id: string) => api<{ ok: true }>(`/api/products/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['products'] })
      await qc.invalidateQueries({ queryKey: ['inventory'] })
    },
  })

  const addBarcodeM = useMutation({
    mutationFn: ({ productId, code }: { productId: string; code: string }) =>
      api<{ barcode: ProductBarcodeRow }>(`/api/products/${productId}/barcodes`, {
        method: 'POST',
        body: JSON.stringify({ code }),
      }),
    onSuccess: async (_res, vars) => {
      await qc.invalidateQueries({ queryKey: ['productBarcodes', vars.productId] })
      setBarcodeInput('')
    },
  })

  const deleteBarcodeM = useMutation({
    mutationFn: ({ productId, barcodeId }: { productId: string; barcodeId: string }) =>
      api<{ ok: true }>(`/api/products/${productId}/barcodes/${barcodeId}`, { method: 'DELETE' }),
    onSuccess: async (_res, vars) => {
      await qc.invalidateQueries({ queryKey: ['productBarcodes', vars.productId] })
    },
  })

  const products = productsQ.data?.products ?? []

  // If user comes from the details page clicking "Editar", open the modal automatically.
  useEffect(() => {
    if (!products.length) return

    const p = new URLSearchParams(window.location.search)
    const editId = p.get('edit')
    if (!editId) return

    const found = products.find((x) => x.id === editId)
    if (!found) return

    openEdit(found)

    // cleanup param to avoid reopening on refresh
    p.delete('edit')
    const next = window.location.pathname + (p.toString() ? `?${p.toString()}` : '')
    window.history.replaceState({}, '', next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products])

  function openCreate() {
    draftStore.clear()
    setDraft((d) => ({ ...d, pendingBarcodes: [] }))
    setBarcodeInput('')
    setBarcodeAutofillNote(null)
    setIsOpen(true)
  }

  function openEdit(p: Product) {
    setDraft({ id: p.id, name: p.name, brand: p.brand ?? '', kind: p.kind ?? 'RAW', unit: p.unit, pendingBarcodes: [] })
    setBarcodeInput('')
    setBarcodeAutofillNote(null)
    setIsOpen(true)
  }

  async function save() {
    const name = draft.name.trim()
    if (!name) return

    const payload = {
      name,
      brand: draft.brand.trim() ? draft.brand.trim() : null,
      kind: draft.kind,
      unit: draft.unit,
    }

    try {
      if (draft.id) {
        await updateM.mutateAsync({ id: draft.id, payload })
        toastUpdated(i, 'product')
      } else {
        const created = await createM.mutateAsync(payload)
        toastCreated(i, 'product')

        const pid = created?.product?.id
        const codes = (draft.pendingBarcodes ?? []).map((c) => c.trim().replace(/\s+/g, '')).filter(Boolean)
        if (pid && codes.length) {
          for (const code of codes) {
            try {
              await addBarcodeM.mutateAsync({ productId: pid, code })
            } catch {
              // ignore individual barcode errors (e.g. duplicates) to avoid blocking product create
            }
          }
        }
      }

      setIsOpen(false)
      draftStore.clear()
    } catch (e: any) {
      toastFailedToSave(i, String(e?.message ?? ''))
    }
  }

  async function remove() {
    if (!draft.id) return
    if (!confirm(i.products.deleteConfirm)) return

    try {
      await deleteM.mutateAsync(draft.id)
      toastDeleted(i, 'product')
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
          <h1 className="text-xl font-semibold tracking-tight">{i.products.title}</h1>
          <p className="text-sm text-neutral-600">{i.products.subtitle}</p>
        </div>

        <button
          className="btn btn-primary"
          onClick={openCreate}
          type="button"
        >
          {i.products.new}
        </button>
      </header>

      {productsQ.isLoading ? (
        <p className="text-sm text-neutral-600">Carregando…</p>
      ) : productsQ.isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Erro ao carregar: {String(productsQ.error)}
        </div>
      ) : (
        <DataTable
          rows={products}
          empty={i.products.empty}
          labels={i.table}
          initialSort={{ key: 'name', dir: 'asc' }}
          onRowClick={(r) => router.push(`/app/products/${r.id}`)}
          columns={[
            {
              key: 'name',
              header: language === 'pt' ? 'Produto' : language === 'es' ? 'Producto' : 'Product',
              sortValue: (r) => r.name,
              searchValue: (r) => r.name,
              render: (r) => (
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-[var(--foreground)]">{r.name}</div>
                  <button
                    type="button"
                    className="text-xs underline text-[var(--muted-foreground)]"
                    onClick={(e) => {
                      e.stopPropagation()
                      openEdit(r)
                    }}
                    title={language === 'pt' ? 'Editar' : language === 'es' ? 'Editar' : 'Edit'}
                  >
                    {language === 'pt' ? 'Editar' : language === 'es' ? 'Editar' : 'Edit'}
                  </button>
                </div>
              ),
            },
            {
              key: 'brand',
              header: language === 'pt' ? 'Marca' : language === 'es' ? 'Marca' : 'Brand',
              sortValue: (r) => r.brand ?? '',
              searchValue: (r) => r.brand ?? '',
              render: (r) => <div className="text-[var(--muted-foreground)]">{r.brand ?? '—'}</div>,
            },
            {
              key: 'unit',
              header: language === 'pt' ? 'Unidade' : language === 'es' ? 'Unidad' : 'Unit',
              sortValue: (r) => r.unit,
              searchValue: (r) => r.unit,
              render: (r) => <div className="text-[var(--muted-foreground)]">{r.unit}</div>,
            },
            {
              key: 'avgCost',
              header: language === 'pt' ? 'Custo méd.' : language === 'es' ? 'Costo prom.' : 'Avg cost',
              sortValue: (r) => Number(r.avgCost ?? 0),
              searchValue: (r) => (r.avgCost == null ? '' : String(r.avgCost)),
              render: (r) => {
                const v = r.avgCost == null ? null : Number(r.avgCost)
                if (!v || !Number.isFinite(v) || v <= 0) return <div className="text-[var(--muted-foreground)]">—</div>
                return <div className="text-[var(--muted-foreground)]">€ {v.toFixed(4)} / {r.unit}</div>
              },
            },
            {
              key: 'kind',
              header: language === 'pt' ? 'Tipo' : language === 'es' ? 'Tipo' : 'Type',
              sortValue: (r) => r.kind ?? '',
              searchValue: (r) => r.kind ?? '',
              render: (r) => (
                <span className="badge badge-solid">
                  {r.kind === 'FINISHED'
                    ? language === 'pt'
                      ? 'Final'
                      : language === 'es'
                        ? 'Final'
                        : 'Finished'
                    : r.kind === 'INTERMEDIATE'
                      ? language === 'pt'
                        ? 'Intermediário'
                        : language === 'es'
                          ? 'Intermedio'
                          : 'Intermediate'
                      : language === 'pt'
                        ? 'Insumo'
                        : language === 'es'
                          ? 'Insumo'
                          : 'Raw'}
                </span>
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
                <h2 className="text-lg font-semibold">{draft.id ? i.products.editTitle : i.products.newTitle}</h2>
                <p className="text-sm text-[var(--text-muted)]">{i.products.modalSubtitle}</p>
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
              {draft.id ? <AuditHistory entityType="Product" entityId={draft.id} /> : null}

              <label className="grid gap-1">
                <FieldLabel required>{i.products.nameLabel}</FieldLabel>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-[var(--foreground)]">{i.products.brandLabel}</span>
                <input
                  value={draft.brand}
                  onChange={(e) => setDraft((d) => ({ ...d, brand: e.target.value }))}
                  placeholder={i.modal.optional}
                  className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                />
              </label>

              <label className="grid gap-1">
                <FieldLabel required>{i.products.kindLabel}</FieldLabel>
                <select
                  value={draft.kind}
                  onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value as any }))}
                  className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                >
                  <option value="RAW">{i.products.kindRaw}</option>
                  <option value="INTERMEDIATE">{language === 'pt' ? 'Intermediário' : language === 'es' ? 'Intermedio' : 'Intermediate'}</option>
                  <option value="FINISHED">{i.products.kindFinished}</option>
                </select>
              </label>

              <label className="grid gap-1">
                <FieldLabel required>{i.products.unitLabel}</FieldLabel>
                <select
                  value={draft.unit}
                  onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))}
                  className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                >
                  {UNIT_OPTIONS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </label>

              <div className="rounded-xl border border-theme p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
                      <Barcode className="size-4" />
                      {language === 'pt' ? 'Códigos de barras' : language === 'es' ? 'Códigos de barras' : 'Barcodes'}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      placeholder={language === 'pt' ? 'EAN / código' : language === 'es' ? 'EAN / código' : 'EAN / code'}
                      className="min-w-[220px] flex-1 rounded-lg border border-theme bg-transparent px-3 py-2 text-sm"
                    />

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setScanOpen(true)}
                    >
                      {language === 'pt' ? 'Escanear' : language === 'es' ? 'Escanear' : 'Scan'}
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={async () => {
                        const code = normalizeCode(barcodeInput)
                        if (!code) return

                        await lookupAndAutofill(code)

                        if (!draft.id) {
                          setDraft((d) => ({ ...d, pendingBarcodes: [...(d.pendingBarcodes ?? []), code] }))
                          setBarcodeInput('')
                          toast.success(language === 'pt' ? 'Código adicionado ao rascunho.' : language === 'es' ? 'Código agregado al borrador.' : 'Code added to draft.')
                          return
                        }

                        try {
                          await addBarcodeM.mutateAsync({ productId: draft.id, code })
                          toast.success(language === 'pt' ? 'Código adicionado.' : language === 'es' ? 'Código agregado.' : 'Code added.')
                        } catch (e: any) {
                          toastFailedToSave(i, String(e?.message ?? e ?? ''))
                        }
                      }}
                      disabled={!barcodeInput.trim() || addBarcodeM.isPending}
                    >
                      <Plus className="size-4" />
                      {language === 'pt' ? 'Adicionar' : language === 'es' ? 'Agregar' : 'Add'}
                    </button>
                  </div>

                  {barcodeAutofillNote ? (
                    <div className="mt-2 rounded-lg border border-theme bg-[var(--surface)]/40 px-3 py-2 text-xs text-[var(--muted-foreground)]">
                      {barcodeAutofillNote}
                    </div>
                  ) : null}

                  <div className="mt-3 space-y-2">
                    {draft.id ? (
                      barcodesQ.isLoading ? (
                        <div className="text-sm text-[var(--muted-foreground)]">{i.common.loading}</div>
                      ) : (barcodesQ.data?.barcodes ?? []).length ? (
                        (barcodesQ.data?.barcodes ?? []).map((b) => (
                          <div key={b.id} className="flex items-center justify-between gap-3 rounded-lg border border-theme px-3 py-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-[var(--foreground)]">{b.code}</div>
                              <div className="text-xs text-[var(--muted-foreground)]">{b.source}</div>
                            </div>
                            <button
                              type="button"
                              className="btn btn-danger-soft btn-sm"
                              onClick={async () => {
                                try {
                                  await deleteBarcodeM.mutateAsync({ productId: draft.id as string, barcodeId: b.id })
                                  toast.success(language === 'pt' ? 'Código removido.' : language === 'es' ? 'Código eliminado.' : 'Code removed.')
                                } catch (e: any) {
                                  toastFailedToDelete(i, String(e?.message ?? e ?? ''))
                                }
                              }}
                              disabled={deleteBarcodeM.isPending}
                              title={language === 'pt' ? 'Remover' : language === 'es' ? 'Eliminar' : 'Remove'}
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-[var(--muted-foreground)]">—</div>
                      )
                    ) : (draft.pendingBarcodes ?? []).length ? (
                      (draft.pendingBarcodes ?? []).map((code, idx) => (
                        <div key={code + idx} className="flex items-center justify-between gap-3 rounded-lg border border-theme px-3 py-2">
                          <div className="truncate text-sm font-medium text-[var(--foreground)]">{code}</div>
                          <button
                            type="button"
                            className="btn btn-danger-soft btn-sm"
                            onClick={() => setDraft((d) => ({ ...d, pendingBarcodes: (d.pendingBarcodes ?? []).filter((_, i2) => i2 !== idx) }))}
                            title={language === 'pt' ? 'Remover' : language === 'es' ? 'Eliminar' : 'Remove'}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-[var(--muted-foreground)]">—</div>
                    )}
                  </div>

                  <div className="mt-2 text-xs text-[var(--muted-foreground)]">
                    {language === 'pt'
                      ? 'Dica: depois de cadastrar aqui, você consegue escanear no pedido de compra/venda.'
                      : language === 'es'
                        ? 'Consejo: después de registrar aquí, podrás escanear en compra/venta.'
                        : 'Tip: once registered here, you can scan in purchase/sales orders.'}
                  </div>
                </div>

              {scanOpen ? (
                <BarcodeScanModal
                  language={language}
                  onClose={() => setScanOpen(false)}
                  onScanned={({ code }) => {
                    const c = normalizeCode(code)
                    if (!c) return
                    setBarcodeInput(c)
                    void lookupAndAutofill(c)
                    setScanOpen(false)
                  }}
                />
              ) : null}
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                className="btn btn-danger-soft"
                onClick={remove}
                type="button"
                disabled={!draft.id || deleteM.isPending}
              >
                {i.products.delete}
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
