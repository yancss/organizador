'use client'

import { useDeferredValue, useMemo, useState } from 'react'

import DataTable from '../ui/data-table'
import { api } from '../api-client'

import { useDraftStorage } from '../use-draft-storage'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { t } from '../i18n'
import { useSettings } from '../settings-context'
import FieldLabel from '../ui/field-label'
import { toast, toastUpdated, toastFailedToSave } from '../toast'

type InventoryItem = {
  id: string
  quantity: string | number
  reservedQty?: string | number | null
  availableQty?: string | number | null
  minimum: string | number | null
  reorderTarget: string | number | null
  criticality?: 'LOW' | 'MEDIUM' | 'HIGH'
  suggestedQty?: string | number | null
  economicSuggestedQty?: string | number | null
  shortageQty?: string | number | null
  coverageDays?: number | null
  projectedQtyAtLeadTime?: string | number | null
  daysToMinimum?: number | null
  purchaseWindowDays?: number | null
  isInPurchaseWindow?: boolean
  riskLevel?: 'urgent' | 'soon' | 'watch' | 'stable'
  riskScore?: number
  preferredSupplierId?: string | null
  preferredSupplier?: { id: string; name: string } | null
  supplierLeadTimeDays?: number | null
  effectiveLeadTimeDays?: number | null
  nextOrderInDays?: number | null
  deliveryOffsetDays?: number | null
  nextOrderDate?: string | null
  expectedArrivalDate?: string | null
  supplierMinOrderQty?: string | number | null
  supplierOrderMultiple?: string | number | null
  updatedAt: string
  product: { id: string; name: string; unit: string; kind?: string; avgCost?: string | number | null }
}
type ListMeta = { page: number; take: number; total: number; totalPages: number }
type Warehouse = { id: string; name: string; code: string; isDefault: boolean }
type InventoryLocation = { id: string; name: string; code: string; isDefault: boolean; quantity: string | number; updatedAt: string | null }
type InventoryMovementRow = {
  id: string
  movementType:
    | 'MANUAL_ADJUSTMENT'
    | 'PURCHASE_RECEIPT'
    | 'PURCHASE_RECEIPT_REVERSAL'
    | 'PRODUCTION_CONSUMPTION'
    | 'PRODUCTION_OUTPUT'
    | 'DELIVERY_SHIPMENT'
    | 'DELIVERY_RETURN'
    | 'TRANSFER_OUT'
    | 'TRANSFER_IN'
  quantity: string | number
  unitCost?: string | number | null
  referenceType?: string | null
  referenceId?: string | null
  observations?: string | null
  balanceAfterGlobal?: string | number | null
  balanceAfterWarehouse?: string | number | null
  createdAt: string
  product: { id: string; name: string; unit: string }
  warehouse?: { id: string; name: string; code: string } | null
}
type InventoryLotRow = {
  id: string
  lotCode: string
  expiresAt: string | null
  serialCodes?: string[]
  quantity: string | number
  receivedAt: string
  notes?: string | null
  warehouseId?: string | null
  warehouseName?: string | null
  warehouseCode?: string | null
  purchaseOrderId?: string | null
  supplierId?: string | null
  supplierName?: string | null
}
type InventoryTraceEventRow = {
  id: string
  productId: string
  warehouseId?: string | null
  lotId?: string | null
  eventType: string
  quantity: string | number
  serialCodes?: string[]
  referenceType?: string | null
  referenceId?: string | null
  notes?: string | null
  createdAt: string
  productName?: string | null
  productUnit?: string | null
  warehouseName?: string | null
  lotCode?: string | null
  lotExpiresAt?: string | null
}
type Supplier = { id: string; name: string }
type ReplenishmentGroup = {
  supplierId: string | null
  supplierName: string | null
  nextOrderDate: string | null
  expectedArrivalDate: string | null
  nextOrderInDays: number | null
  readyToOrder?: boolean
  itemCount: number
  urgentCount: number
  consolidationCount: number
  totalSuggestedQty: number
  totalEconomicQty: number
  economicItemCount: number
  estimatedCost: number
  economicEstimatedCost: number
  minimumOrderValue?: number | null
  missingToMinimumOrderValue?: number
}

// (moved to api-client.ts)


type Draft = {
  productId: string
  productName: string
  unit: string // base unit (Product.unit)
  inputUnit: string // unit the user is typing in
  quantity: string
  minimum: string
  reorderTarget: string
  criticality: 'LOW' | 'MEDIUM' | 'HIGH'
  preferredSupplierId: string
  supplierLeadTimeDays: string
  supplierMinOrderQty: string
  supplierOrderMultiple: string
  adjustmentReason: 'COUNT' | 'LOSS' | 'DAMAGE' | 'EXPIRATION' | 'CORRECTION' | 'RETURN' | 'OTHER'
  adjustmentNote: string
}

type TransferDraft = {
  fromWarehouseId: string
  toWarehouseId: string
  sourceLotId: string
  quantity: string
  observations: string
}

type WarehouseDraft = {
  name: string
  code: string
}

type CountDraft = {
  countedQuantity: string
  note: string
}

function emptyDraft(): Draft {
  return {
    productId: '',
    productName: '',
    unit: '',
    inputUnit: '',
    quantity: '',
    minimum: '',
    reorderTarget: '',
    criticality: 'MEDIUM',
    preferredSupplierId: '',
    supplierLeadTimeDays: '',
    supplierMinOrderQty: '',
    supplierOrderMultiple: '',
    adjustmentReason: 'COUNT',
    adjustmentNote: '',
  }
}

function emptyTransferDraft(): TransferDraft {
  return { fromWarehouseId: '', toWarehouseId: '', sourceLotId: '', quantity: '', observations: '' }
}

function emptyWarehouseDraft(): WarehouseDraft {
  return { name: '', code: '' }
}

function emptyCountDraft(): CountDraft {
  return { countedQuantity: '', note: '' }
}

function criticalityWeight(value: 'LOW' | 'MEDIUM' | 'HIGH' | undefined) {
  if (value === 'HIGH') return 2
  if (value === 'MEDIUM') return 1
  return 0
}

export default function InventoryPage() {
  const qc = useQueryClient()
  const { language } = useSettings()
  const i = t(language)

  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [showReplenishment, setShowReplenishment] = useState(false)
  const [transferDraft, setTransferDraft] = useState<TransferDraft>(emptyTransferDraft())
  const [warehouseDraft, setWarehouseDraft] = useState<WarehouseDraft>(emptyWarehouseDraft())
  const [countDraft, setCountDraft] = useState<CountDraft>(emptyCountDraft())
  const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false)
  const [isCountModalOpen, setIsCountModalOpen] = useState(false)
  const [replenishmentSupplierId, setReplenishmentSupplierId] = useState('')
  const [replenishmentRisk, setReplenishmentRisk] = useState<'all' | 'actionable' | 'urgent' | 'soon' | 'watch'>('actionable')
  const [replenishmentReadyOnly, setReplenishmentReadyOnly] = useState(false)
  const draftStore = useDraftStorage<Draft>('draft:inventory', emptyDraft)
  const draft = draftStore.value
  const setDraft = draftStore.setValue
  const deferredQuery = useDeferredValue(query)

  const invQ = useQuery({
    queryKey: ['inventory', deferredQuery, page, showReplenishment],
    queryFn: () =>
      api<{ items: InventoryItem[]; meta: ListMeta }>(
        `/api/inventory?q=${encodeURIComponent(deferredQuery)}&page=${page}&take=25${showReplenishment ? '&mode=replenishment' : ''}`,
      ),
  })

  const updateM = useMutation({
    mutationFn: ({ productId, payload }: { productId: string; payload: any }) =>
      api<{ item: InventoryItem }>(`/api/inventory/${productId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['inventory'] })
      await qc.invalidateQueries({ queryKey: ['inventory-replenishment'] })
      await qc.invalidateQueries({ queryKey: ['inventory-movements'] })
    },
  })

  const suppliersQ = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const data = await api<{ clients: Array<{ id: string; name: string; roles: string[] }> }>('/api/clients')
      const suppliers = (data.clients ?? []).filter((c) => (c.roles ?? []).includes('SUPPLIER'))
      return { suppliers: suppliers.map((s) => ({ id: s.id, name: s.name })) }
    },
  })

  const replenishmentQ = useQuery({
    queryKey: ['inventory-replenishment', replenishmentSupplierId, deferredQuery, replenishmentRisk, replenishmentReadyOnly],
    queryFn: () =>
      api<{
        items: InventoryItem[]
        groups: ReplenishmentGroup[]
        summary: {
          urgentCount: number
          soonCount: number
          watchCount: number
          readyGroupCount: number
          suggestedQtyTotal: number
          estimatedCostTotal: number
        }
        meta: ListMeta
      }>(
        `/api/purchase-orders/replenishment?take=100${replenishmentSupplierId ? `&supplierId=${encodeURIComponent(replenishmentSupplierId)}` : ''}${
          deferredQuery.trim() ? `&q=${encodeURIComponent(deferredQuery.trim())}` : ''
        }&risk=${encodeURIComponent(replenishmentRisk)}${replenishmentReadyOnly ? '&readyOnly=1' : ''}`,
      ),
    enabled: showReplenishment,
  })

  const createReplenishmentDraftM = useMutation({
    mutationFn: (payload: { supplierId: string; nextOrderDate?: string | null; observations?: string | null }) =>
      api<{ purchaseOrder: { id: string; code: string } }>('/api/purchase-orders/replenishment/draft', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  })

  const warehousesQ = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api<{ warehouses: Warehouse[] }>('/api/warehouses'),
  })

  const locationsQ = useQuery({
    queryKey: ['inventory-locations', draft.productId],
    queryFn: () => api<{ locations: InventoryLocation[] }>(`/api/inventory/${draft.productId}/locations`),
    enabled: isOpen && !!draft.productId,
  })

  const movementsQ = useQuery({
    queryKey: ['inventory-movements', draft.productId],
    queryFn: () => api<{ movements: InventoryMovementRow[] }>(`/api/inventory/movements?productId=${draft.productId}&take=12`),
    enabled: isOpen && !!draft.productId,
  })

  const lotsQ = useQuery({
    queryKey: ['inventory-lots', draft.productId],
    queryFn: () => api<{ lots: InventoryLotRow[] }>(`/api/inventory/${draft.productId}/lots`),
    enabled: isOpen && !!draft.productId,
  })

  const traceQ = useQuery({
    queryKey: ['inventory-trace', draft.productId],
    queryFn: () => api<{ events: InventoryTraceEventRow[] }>(`/api/inventory/trace?productId=${draft.productId}&take=12`),
    enabled: isOpen && !!draft.productId,
  })

  const createWarehouseM = useMutation({
    mutationFn: (payload: { name: string; code?: string }) =>
      api<{ warehouse: Warehouse }>('/api/warehouses', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['warehouses'] })
      await qc.invalidateQueries({ queryKey: ['inventory-locations', draft.productId] })
    },
  })

  const transferM = useMutation({
    mutationFn: (payload: any) =>
      api('/api/inventory/transfers', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['inventory'] })
      await qc.invalidateQueries({ queryKey: ['inventory-locations', draft.productId] })
      await qc.invalidateQueries({ queryKey: ['inventory-replenishment'] })
      await qc.invalidateQueries({ queryKey: ['inventory-movements', draft.productId] })
      await qc.invalidateQueries({ queryKey: ['inventory-trace', draft.productId] })
    },
  })

  const items = showReplenishment ? replenishmentQ.data?.items ?? [] : invQ.data?.items ?? []
  const meta = showReplenishment ? replenishmentQ.data?.meta : invQ.data?.meta

  const rows = useMemo(() => {
    return items
      .map((it) => {
        const q = Number(it.quantity)
        const reserved = it.reservedQty == null ? 0 : Number(it.reservedQty)
        const available = it.availableQty == null ? q : Number(it.availableQty)
        const m = it.minimum == null ? null : Number(it.minimum)
        const rt = it.reorderTarget == null ? null : Number(it.reorderTarget)
        const suggested = it.suggestedQty == null ? 0 : Number(it.suggestedQty)
        const economicSuggested = it.economicSuggestedQty == null ? 0 : Number(it.economicSuggestedQty)
        const shortage = it.shortageQty == null ? 0 : Number(it.shortageQty)
        const coverageDays = it.coverageDays == null ? null : Number(it.coverageDays)
        const effectiveLeadTimeDays = it.effectiveLeadTimeDays == null ? null : Number(it.effectiveLeadTimeDays)
        const nextOrderInDays = it.nextOrderInDays == null ? null : Number(it.nextOrderInDays)
        const projectedQtyAtLeadTime = it.projectedQtyAtLeadTime == null ? null : Number(it.projectedQtyAtLeadTime)
        const daysToMinimum = it.daysToMinimum == null ? null : Number(it.daysToMinimum)
        const purchaseWindowDays = it.purchaseWindowDays == null ? null : Number(it.purchaseWindowDays)
        const below = m != null && !Number.isNaN(q) && q < m
        return { ...it, q, reserved, available, m, rt, suggested, economicSuggested, shortage, coverageDays, effectiveLeadTimeDays, nextOrderInDays, projectedQtyAtLeadTime, daysToMinimum, purchaseWindowDays, below }
      })
      .sort((a, b) =>
        showReplenishment
          ? (Number(b.riskScore ?? 0) - Number(a.riskScore ?? 0)) ||
            (criticalityWeight(b.criticality) - criticalityWeight(a.criticality)) ||
            a.product.name.localeCompare(b.product.name)
          : a.product.name.localeCompare(b.product.name),
      )
  }, [items, showReplenishment])

  const inventoryOverview = useMemo(() => {
    const belowMinimum = rows.filter((row) => row.below).length
    const urgent = rows.filter((row) => row.riskLevel === 'urgent').length
    const purchaseWindow = rows.filter((row) => row.isInPurchaseWindow).length
    return {
      total: rows.length,
      belowMinimum,
      urgent,
      purchaseWindow,
    }
  }, [rows])

  const locationUi = useMemo(
    () => ({
      newLocation: language === 'pt' ? 'Novo local' : language === 'es' ? 'Nueva ubicacion' : 'New location',
      newLocationTitle: language === 'pt' ? 'Novo local de estoque' : language === 'es' ? 'Nueva ubicacion de inventario' : 'New stock location',
      newLocationSubtitle:
        language === 'pt'
          ? 'Crie um deposito/local para usar em transferencias internas.'
          : language === 'es'
            ? 'Crea un deposito/ubicacion para usar en transferencias internas.'
            : 'Create a warehouse/location to use in internal transfers.',
      locationName: language === 'pt' ? 'Nome do local' : language === 'es' ? 'Nombre de la ubicacion' : 'Location name',
      locationCode: language === 'pt' ? 'Codigo curto' : language === 'es' ? 'Codigo corto' : 'Short code',
      locationCodeHelp:
        language === 'pt'
          ? 'Opcional. Se vazio, usamos um codigo automatico.'
          : language === 'es'
            ? 'Opcional. Si queda vacio, usamos un codigo automatico.'
            : 'Optional. Leave blank to use an automatic code.',
      locationCreated: language === 'pt' ? 'Local criado.' : language === 'es' ? 'Ubicacion creada.' : 'Location created.',
      balanceByLocation: language === 'pt' ? 'Saldo por local' : language === 'es' ? 'Saldo por ubicacion' : 'Balance by location',
      balanceHelp:
        language === 'pt'
          ? 'Transferencias movem saldo entre locais sem alterar o total global.'
          : language === 'es'
            ? 'Las transferencias mueven saldo entre ubicaciones sin alterar el total global.'
            : 'Transfers move stock between locations without changing the global total.',
      defaultLocation: language === 'pt' ? 'Padrao' : language === 'es' ? 'Predeterminada' : 'Default',
      noLocationBalances:
        language === 'pt' ? 'Sem saldos por local ainda.' : language === 'es' ? 'Sin saldos por ubicacion todavia.' : 'No location balances yet.',
      transferStock: language === 'pt' ? 'Transferir estoque' : language === 'es' ? 'Transferir inventario' : 'Transfer stock',
      source: language === 'pt' ? 'Origem' : language === 'es' ? 'Origen' : 'Source',
      destination: language === 'pt' ? 'Destino' : language === 'es' ? 'Destino' : 'Destination',
      movementHistory: language === 'pt' ? 'Historico recente' : language === 'es' ? 'Historial reciente' : 'Recent history',
      movementEmpty:
        language === 'pt' ? 'Sem movimentacoes recentes.' : language === 'es' ? 'Sin movimientos recientes.' : 'No recent movements.',
      lotsTitle: language === 'pt' ? 'Lotes e validades' : language === 'es' ? 'Lotes y caducidades' : 'Lots and expiry',
      lotsEmpty:
        language === 'pt' ? 'Sem lotes registrados para este item.' : language === 'es' ? 'Sin lotes registrados para este item.' : 'No lots registered for this item.',
      transferNote:
        language === 'pt'
          ? 'Observacao da transferencia (opcional)'
          : language === 'es'
            ? 'Observacion de la transferencia (opcional)'
            : 'Transfer note (optional)',
    }),
    [language],
  )

  function movementTypeLabel(type: InventoryMovementRow['movementType']) {
    const mapPt: Record<InventoryMovementRow['movementType'], string> = {
      MANUAL_ADJUSTMENT: 'Ajuste manual',
      PURCHASE_RECEIPT: 'Recebimento de compra',
      PURCHASE_RECEIPT_REVERSAL: 'Estorno de recebimento',
      PRODUCTION_CONSUMPTION: 'Consumo em producao',
      PRODUCTION_OUTPUT: 'Producao concluida',
      DELIVERY_SHIPMENT: 'Expedicao/saida',
      DELIVERY_RETURN: 'Retorno de entrega',
      TRANSFER_OUT: 'Transferencia de saida',
      TRANSFER_IN: 'Transferencia de entrada',
    }
    const mapEs: Record<InventoryMovementRow['movementType'], string> = {
      MANUAL_ADJUSTMENT: 'Ajuste manual',
      PURCHASE_RECEIPT: 'Recepcion de compra',
      PURCHASE_RECEIPT_REVERSAL: 'Reversion de recepcion',
      PRODUCTION_CONSUMPTION: 'Consumo en produccion',
      PRODUCTION_OUTPUT: 'Produccion terminada',
      DELIVERY_SHIPMENT: 'Expedicion/salida',
      DELIVERY_RETURN: 'Retorno de entrega',
      TRANSFER_OUT: 'Transferencia de salida',
      TRANSFER_IN: 'Transferencia de entrada',
    }
    const mapEn: Record<InventoryMovementRow['movementType'], string> = {
      MANUAL_ADJUSTMENT: 'Manual adjustment',
      PURCHASE_RECEIPT: 'Purchase receipt',
      PURCHASE_RECEIPT_REVERSAL: 'Receipt reversal',
      PRODUCTION_CONSUMPTION: 'Production consumption',
      PRODUCTION_OUTPUT: 'Production output',
      DELIVERY_SHIPMENT: 'Shipment',
      DELIVERY_RETURN: 'Delivery return',
      TRANSFER_OUT: 'Transfer out',
      TRANSFER_IN: 'Transfer in',
    }

    if (language === 'pt') return mapPt[type]
    if (language === 'es') return mapEs[type]
    return mapEn[type]
  }

  function openEdit(it: InventoryItem) {
    setDraft({
      productId: it.product.id,
      productName: it.product.name,
      unit: it.product.unit,
      inputUnit: it.product.unit,
      quantity: String(it.quantity ?? ''),
      minimum: it.minimum == null ? '' : String(it.minimum),
      reorderTarget: it.reorderTarget == null ? '' : String(it.reorderTarget),
      criticality: it.criticality ?? 'MEDIUM',
      preferredSupplierId: it.preferredSupplierId ?? '',
      supplierLeadTimeDays: it.supplierLeadTimeDays == null ? '' : String(it.supplierLeadTimeDays),
      supplierMinOrderQty: it.supplierMinOrderQty == null ? '' : String(it.supplierMinOrderQty),
      supplierOrderMultiple: it.supplierOrderMultiple == null ? '' : String(it.supplierOrderMultiple),
      adjustmentReason: 'COUNT',
      adjustmentNote: '',
    })
    setTransferDraft(emptyTransferDraft())
    setCountDraft({ countedQuantity: String(it.quantity ?? ''), note: '' })
    setIsOpen(true)
  }

  async function saveWarehouseQuick() {
    if (!warehouseDraft.name.trim()) return
    try {
      await createWarehouseM.mutateAsync({
        name: warehouseDraft.name.trim(),
        code: warehouseDraft.code.trim() ? warehouseDraft.code.trim() : undefined,
      })
      toast.success(locationUi.locationCreated)
      setWarehouseDraft(emptyWarehouseDraft())
      setIsWarehouseModalOpen(false)
    } catch (e: any) {
      toastFailedToSave(i, String(e?.message ?? ''))
    }
  }

  async function save() {
    if (!draft.productId) return

    const currentItem = items.find((item) => item.product.id === draft.productId)
    const currentQuantity = currentItem == null ? null : Number(currentItem.quantity ?? 0)
    const nextQuantity = draft.quantity.trim() ? Number(draft.quantity.replace(',', '.')) : undefined
    const quantityChanged =
      nextQuantity !== undefined && currentQuantity != null && Number.isFinite(nextQuantity) && Math.abs(nextQuantity - currentQuantity) > 0.000001

    if (quantityChanged && !draft.adjustmentReason) {
      toastFailedToSave(
        i,
        language === 'pt'
          ? 'Informe o motivo do ajuste de estoque.'
          : language === 'es'
            ? 'Indica el motivo del ajuste de inventario.'
            : 'Provide the inventory adjustment reason.',
      )
      return
    }

    const payload: any = {
      quantity: nextQuantity,
      minimum: draft.minimum.trim() ? Number(draft.minimum.replace(',', '.')) : null,
      reorderTarget: draft.reorderTarget.trim() ? Number(draft.reorderTarget.replace(',', '.')) : null,
      criticality: draft.criticality,
      preferredSupplierId: draft.preferredSupplierId || null,
      supplierLeadTimeDays: draft.supplierLeadTimeDays.trim() ? Number(draft.supplierLeadTimeDays) : null,
      supplierMinOrderQty: draft.supplierMinOrderQty.trim() ? Number(draft.supplierMinOrderQty.replace(',', '.')) : null,
      supplierOrderMultiple: draft.supplierOrderMultiple.trim() ? Number(draft.supplierOrderMultiple.replace(',', '.')) : null,
      adjustmentReason: quantityChanged ? draft.adjustmentReason : undefined,
      adjustmentNote: quantityChanged && draft.adjustmentNote.trim() ? draft.adjustmentNote.trim() : undefined,
      unit: draft.inputUnit || undefined,
    }

    try {
      await updateM.mutateAsync({ productId: draft.productId, payload })
      toastUpdated(i, 'inventory')
      setIsOpen(false)
      draftStore.clear()
    } catch (e: any) {
      toastFailedToSave(i, String(e?.message ?? ''))
    }
  }

  async function transferStock() {
    if (!draft.productId) return
    const quantity = Number(transferDraft.quantity.replace(',', '.'))
    if (!transferDraft.fromWarehouseId || !transferDraft.toWarehouseId || !Number.isFinite(quantity) || quantity <= 0) {
      toastFailedToSave(i, language === 'pt' ? 'Preencha origem, destino e quantidade.' : language === 'es' ? 'Completa origen, destino y cantidad.' : 'Fill source, destination, and quantity.')
      return
    }

    try {
      await transferM.mutateAsync({
        productId: draft.productId,
        fromWarehouseId: transferDraft.fromWarehouseId,
        toWarehouseId: transferDraft.toWarehouseId,
        sourceLotId: transferDraft.sourceLotId || null,
        quantity,
        unit: draft.inputUnit || draft.unit,
        observations: transferDraft.observations.trim() ? transferDraft.observations.trim() : null,
      })
      toast.success(language === 'pt' ? 'Transferencia registrada.' : language === 'es' ? 'Transferencia registrada.' : 'Transfer recorded.')
      setTransferDraft(emptyTransferDraft())
    } catch (e: any) {
      toastFailedToSave(i, String(e?.message ?? ''))
    }
  }

  async function createDraftFromReplenishment(args?: { supplierId?: string | null; nextOrderDate?: string | null }) {
    const supplierId = args?.supplierId ?? replenishmentSupplierId
    if (!supplierId) {
      toastFailedToSave(i, language === 'pt' ? 'Selecione um fornecedor.' : language === 'es' ? 'Selecciona un proveedor.' : 'Select a supplier.')
      return
    }
    try {
      const res = await createReplenishmentDraftM.mutateAsync({
        supplierId,
        nextOrderDate: args?.nextOrderDate ?? null,
      })
      toast.success(
        language === 'pt'
          ? `Rascunho criado: ${res.purchaseOrder.code}`
          : language === 'es'
            ? `Borrador creado: ${res.purchaseOrder.code}`
            : `Draft created: ${res.purchaseOrder.code}`,
      )
    } catch (e: any) {
      toastFailedToSave(i, String(e?.message ?? ''))
    }
  }

  async function saveCount() {
    if (!draft.productId) return
    const countedQuantity = Number(countDraft.countedQuantity.replace(',', '.'))
    if (!Number.isFinite(countedQuantity) || countedQuantity < 0) {
      toastFailedToSave(
        i,
        language === 'pt'
          ? 'Informe uma quantidade contada valida.'
          : language === 'es'
            ? 'Indica una cantidad contada valida.'
            : 'Enter a valid counted quantity.',
      )
      return
    }

    try {
      await updateM.mutateAsync({
        productId: draft.productId,
        payload: {
          quantity: countedQuantity,
          adjustmentReason: 'COUNT',
          adjustmentNote: countDraft.note.trim() || null,
          unit: draft.inputUnit || draft.unit,
        },
      })
      toastUpdated(i, 'inventory')
      setDraft((current) => ({ ...current, quantity: String(countedQuantity), adjustmentReason: 'COUNT', adjustmentNote: '' }))
      setCountDraft(emptyCountDraft())
      setIsCountModalOpen(false)
    } catch (e: any) {
      toastFailedToSave(i, String(e?.message ?? ''))
    }
  }

  return (
    <div className="space-y-7">
      <header className="rounded-2xl border border-theme bg-[var(--surface-2)] px-6 py-6 shadow-[var(--shadow-sm)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{i.inventory.title}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`btn ${showReplenishment ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setShowReplenishment((v) => !v)
                setPage(1)
              }}
            >
              {showReplenishment
                ? language === 'pt'
                  ? 'Ver tudo'
                  : language === 'es'
                    ? 'Ver todo'
                    : 'View all'
                : language === 'pt'
                  ? 'Ver reposicao'
                  : language === 'es'
                    ? 'Ver reposicion'
                    : 'View replenishment'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setIsWarehouseModalOpen(true)} disabled={createWarehouseM.isPending}>
              {locationUi.newLocation}
            </button>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="surface rounded-2xl border border-theme p-5">
          <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
            {language === 'pt' ? 'Itens visiveis' : language === 'es' ? 'Items visibles' : 'Visible items'}
          </div>
          <div className="mt-1 text-2xl font-semibold">{inventoryOverview.total}</div>
        </div>
        <div className="surface rounded-2xl border border-theme p-5">
          <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
            {language === 'pt' ? 'Abaixo do minimo' : language === 'es' ? 'Bajo minimo' : 'Below minimum'}
          </div>
          <div className="mt-1 text-2xl font-semibold">{inventoryOverview.belowMinimum}</div>
        </div>
        <div className="surface rounded-2xl border border-theme p-5">
          <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
            {language === 'pt' ? 'Urgentes' : language === 'es' ? 'Urgentes' : 'Urgent'}
          </div>
          <div className="mt-1 text-2xl font-semibold">{showReplenishment ? replenishmentQ.data?.summary?.urgentCount ?? 0 : inventoryOverview.urgent}</div>
        </div>
        <div className="surface rounded-2xl border border-theme p-5">
          <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
            {language === 'pt' ? 'Janela de compra' : language === 'es' ? 'Ventana de compra' : 'Purchase window'}
          </div>
          <div className="mt-1 text-2xl font-semibold">{showReplenishment ? replenishmentQ.data?.summary?.readyGroupCount ?? 0 : inventoryOverview.purchaseWindow}</div>
        </div>
      </section>

      <div className="surface rounded-2xl border border-theme p-5">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
            {language === 'pt' ? 'Consulta operacional' : language === 'es' ? 'Consulta operativa' : 'Operational view'}
          </div>
          <p className="mt-2 max-w-2xl text-sm text-[var(--text-muted)]">
            {language === 'pt'
              ? 'Use a busca para reduzir o ruído da grade e chegar mais rápido ao item certo.'
              : language === 'es'
                ? 'Usa la busqueda para reducir el ruido de la tabla y llegar mas rapido al item correcto.'
                : 'Use search to reduce table noise and reach the right item faster.'}
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full max-w-lg">
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setPage(1)
                }}
                placeholder={i.table.searchPlaceholder}
                className="w-full rounded-lg border border-theme bg-transparent px-3 py-2 text-sm"
              />
            </div>

            <div className="rounded-xl bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
              <span>{meta ? `${meta.total}` : '0'}</span>{' '}
              <span>{language === 'pt' ? 'registros' : language === 'es' ? 'registros' : 'records'}</span>
            </div>
          </div>
        </div>
      </div>

      {showReplenishment ? (
        <div className="surface rounded-2xl border border-theme p-4">
          <div className="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-xl border border-theme bg-[var(--surface-2)] px-3 py-2">
              <div className="text-xs text-[var(--muted-foreground)]">{language === 'pt' ? 'Urgentes' : language === 'es' ? 'Urgentes' : 'Urgent'}</div>
              <div className="text-lg font-semibold">{replenishmentQ.data?.summary?.urgentCount ?? 0}</div>
            </div>
            <div className="rounded-xl border border-theme bg-[var(--surface-2)] px-3 py-2">
              <div className="text-xs text-[var(--muted-foreground)]">{language === 'pt' ? 'Em breve' : language === 'es' ? 'Pronto' : 'Soon'}</div>
              <div className="text-lg font-semibold">{replenishmentQ.data?.summary?.soonCount ?? 0}</div>
            </div>
            <div className="rounded-xl border border-theme bg-[var(--surface-2)] px-3 py-2">
              <div className="text-xs text-[var(--muted-foreground)]">{language === 'pt' ? 'Monitorar' : language === 'es' ? 'Monitorear' : 'Watch'}</div>
              <div className="text-lg font-semibold">{replenishmentQ.data?.summary?.watchCount ?? 0}</div>
            </div>
            <div className="rounded-xl border border-theme bg-[var(--surface-2)] px-3 py-2">
              <div className="text-xs text-[var(--muted-foreground)]">{language === 'pt' ? 'Janelas prontas' : language === 'es' ? 'Ventanas listas' : 'Ready windows'}</div>
              <div className="text-lg font-semibold">{replenishmentQ.data?.summary?.readyGroupCount ?? 0}</div>
            </div>
            <div className="rounded-xl border border-theme bg-[var(--surface-2)] px-3 py-2">
              <div className="text-xs text-[var(--muted-foreground)]">{language === 'pt' ? 'Custo estimado' : language === 'es' ? 'Costo estimado' : 'Estimated cost'}</div>
              <div className="text-lg font-semibold">€ {Number(replenishmentQ.data?.summary?.estimatedCostTotal ?? 0).toFixed(2)}</div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="grid gap-1">
              <FieldLabel>{language === 'pt' ? 'Fornecedor para gerar compra' : language === 'es' ? 'Proveedor para generar compra' : 'Supplier to generate PO'}</FieldLabel>
              <select
                value={replenishmentSupplierId}
                onChange={(e) => setReplenishmentSupplierId(e.target.value)}
                className="w-full rounded-lg border border-theme bg-transparent px-3 py-2 text-sm"
              >
                <option value="">{language === 'pt' ? 'Todos os fornecedores' : language === 'es' ? 'Todos los proveedores' : 'All suppliers'}</option>
                {(suppliersQ.data?.suppliers ?? []).map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn btn-secondary" onClick={() => void createDraftFromReplenishment()} disabled={createReplenishmentDraftM.isPending || !replenishmentSupplierId}>
              {language === 'pt' ? 'Gerar pedido rascunho' : language === 'es' ? 'Generar pedido borrador' : 'Generate draft PO'}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {([
              ['actionable', language === 'pt' ? 'Acionaveis' : language === 'es' ? 'Accionables' : 'Actionable'],
              ['urgent', language === 'pt' ? 'Urgentes' : language === 'es' ? 'Urgentes' : 'Urgent'],
              ['soon', language === 'pt' ? 'Em breve' : language === 'es' ? 'Pronto' : 'Soon'],
              ['watch', language === 'pt' ? 'Monitorar' : language === 'es' ? 'Monitorear' : 'Watch'],
              ['all', language === 'pt' ? 'Todos' : language === 'es' ? 'Todos' : 'All'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`btn btn-sm ${replenishmentRisk === value ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setReplenishmentRisk(value)}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              className={`btn btn-sm ${replenishmentReadyOnly ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setReplenishmentReadyOnly((current) => !current)}
            >
              {language === 'pt' ? 'Somente janelas prontas' : language === 'es' ? 'Solo ventanas listas' : 'Ready windows only'}
            </button>
          </div>
          <div className="mt-3 grid gap-2">
            {(replenishmentQ.data?.groups ?? []).map((group) => (
              <div key={`${group.supplierId ?? 'unassigned'}:${group.nextOrderDate ?? 'unscheduled'}`} className="flex flex-col gap-3 rounded-lg border border-theme px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="font-medium">{group.supplierName ?? (language === 'pt' ? 'Sem fornecedor definido' : language === 'es' ? 'Sin proveedor definido' : 'No supplier assigned')}</div>
                  <div className="text-[var(--text-muted)]">
                    {group.itemCount} {language === 'pt' ? 'itens' : language === 'es' ? 'itens' : 'items'}
                  </div>
                  <div className="text-xs text-[var(--muted-foreground)]">
                    {group.nextOrderDate
                      ? language === 'pt'
                        ? `pedido ${group.nextOrderDate}`
                        : language === 'es'
                          ? `pedido ${group.nextOrderDate}`
                          : `order ${group.nextOrderDate}`
                      : language === 'pt'
                        ? 'sem data sugerida'
                        : language === 'es'
                          ? 'sin fecha sugerida'
                          : 'no suggested date'}
                    {group.expectedArrivalDate
                      ? language === 'pt'
                        ? ` | chegada ${group.expectedArrivalDate}`
                        : language === 'es'
                          ? ` | llegada ${group.expectedArrivalDate}`
                          : ` | arrival ${group.expectedArrivalDate}`
                      : ''}
                    {group.nextOrderInDays != null
                      ? language === 'pt'
                        ? ` | ${group.nextOrderInDays <= 0 ? 'janela aberta agora' : `em ${group.nextOrderInDays}d`}`
                        : language === 'es'
                          ? ` | ${group.nextOrderInDays <= 0 ? 'ventana abierta ahora' : `en ${group.nextOrderInDays}d`}`
                          : ` | ${group.nextOrderInDays <= 0 ? 'window open now' : `in ${group.nextOrderInDays}d`}`
                      : ''}
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:text-right">
                  <div className="text-[var(--muted-foreground)]">
                    <div>{group.totalSuggestedQty}</div>
                    <div className="text-xs">€ {Number(group.estimatedCost ?? 0).toFixed(2)}</div>
                    {group.missingToMinimumOrderValue && group.missingToMinimumOrderValue > 0 ? (
                      <div className="text-xs text-amber-700">
                        {language === 'pt'
                          ? `faltam € ${Number(group.missingToMinimumOrderValue).toFixed(2)} para pedido minimo`
                          : language === 'es'
                            ? `faltan € ${Number(group.missingToMinimumOrderValue).toFixed(2)} para pedido minimo`
                            : `missing € ${Number(group.missingToMinimumOrderValue).toFixed(2)} to reach minimum order`}
                      </div>
                    ) : null}
                  </div>
                  {group.supplierId ? (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={createReplenishmentDraftM.isPending}
                      onClick={() => void createDraftFromReplenishment({ supplierId: group.supplierId, nextOrderDate: group.nextOrderDate })}
                    >
                      {group.readyToOrder
                        ? language === 'pt'
                          ? 'Gerar desta janela'
                          : language === 'es'
                            ? 'Generar de esta ventana'
                            : 'Draft this window'
                        : language === 'pt'
                          ? 'Preparar desta janela'
                          : language === 'es'
                            ? 'Preparar de esta ventana'
                            : 'Prepare this window'}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {(showReplenishment ? replenishmentQ.isLoading : invQ.isLoading) ? (
        <p className="text-sm text-[var(--text-muted)]">Carregando...</p>
      ) : (showReplenishment ? replenishmentQ.isError : invQ.isError) ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Erro ao carregar: {String(showReplenishment ? replenishmentQ.error : invQ.error)}
        </div>
      ) : (
        <DataTable
          rows={rows}
          empty={i.inventory.empty}
          labels={i.table}
          initialSort={{ key: 'product', dir: 'asc' }}
          onRowClick={openEdit}
          showSearch={false}
          showFooter={false}
          pageSize={Math.max(1, rows.length)}
          columns={[
            {
              key: 'product',
              header: language === 'pt' ? 'Produto' : language === 'es' ? 'Producto' : 'Product',
              sortValue: (r) => r.product.name,
              searchValue: (r) => r.product.name,
              render: (r) => (
                <div className="font-medium text-[var(--foreground)]">
                  {r.product.name}
                  <span
                    className={`ml-2 badge ${
                      r.criticality === 'HIGH' ? 'badge-danger' : r.criticality === 'MEDIUM' ? 'badge-solid' : 'badge-secondary'
                    }`}
                  >
                    {r.criticality === 'HIGH'
                      ? language === 'pt'
                        ? 'Crit. alta'
                        : language === 'es'
                          ? 'Crit. alta'
                          : 'High crit.'
                      : r.criticality === 'LOW'
                        ? language === 'pt'
                          ? 'Crit. baixa'
                          : language === 'es'
                            ? 'Crit. baja'
                            : 'Low crit.'
                        : language === 'pt'
                          ? 'Crit. media'
                          : language === 'es'
                            ? 'Crit. media'
                            : 'Med. crit.'}
                  </span>
                  {showReplenishment ? (
                    <span className={`ml-2 badge ${r.riskLevel === 'urgent' ? 'badge-danger' : r.riskLevel === 'soon' ? 'badge-solid' : 'badge-secondary'}`}>
                      {r.riskLevel === 'urgent'
                        ? language === 'pt'
                          ? 'Urgente'
                          : language === 'es'
                            ? 'Urgente'
                            : 'Urgent'
                        : r.riskLevel === 'soon'
                          ? language === 'pt'
                            ? 'Em breve'
                            : language === 'es'
                              ? 'Pronto'
                              : 'Soon'
                          : language === 'pt'
                            ? 'Monitorar'
                            : language === 'es'
                              ? 'Monitorear'
                            : 'Watch'}
                    </span>
                  ) : r.isInPurchaseWindow ? (
                    <span className="ml-2 badge badge-solid">
                      {language === 'pt' ? 'Janela de compra' : language === 'es' ? 'Ventana de compra' : 'Purchase window'}
                    </span>
                  ) : r.below ? (
                    <span className="ml-2 badge badge-danger">
                      {language === 'pt' ? 'Abaixo do min.' : language === 'es' ? 'Bajo minimo' : 'Below min'}
                    </span>
                  ) : null}
                </div>
              ),
            },
            {
              key: 'qty',
              header: language === 'pt' ? 'Qtd.' : language === 'es' ? 'Cant.' : 'Qty',
              sortValue: (r) => r.q,
              searchValue: (r) => String(r.quantity),
              render: (r) => (
                <div className="text-[var(--muted-foreground)]">
                  {String(r.quantity)} {r.product.unit}
                  {r.reserved > 0 ? (
                    <span className="block text-xs text-[var(--text-muted)]">
                      {language === 'pt'
                        ? `${r.available} disponivel | ${r.reserved} reservado`
                        : language === 'es'
                          ? `${r.available} disponible | ${r.reserved} reservado`
                          : `${r.available} available | ${r.reserved} reserved`}
                    </span>
                  ) : null}
                </div>
              ),
            },
            {
              key: 'min',
              header: language === 'pt' ? 'Min.' : language === 'es' ? 'Min.' : 'Min',
              sortValue: (r) => (r.minimum == null ? -1 : r.m ?? -1),
              searchValue: (r) => (r.minimum == null ? '' : String(r.minimum)),
              render: (r) => (
                <div className="text-[var(--muted-foreground)]">
                  {r.minimum == null ? '-' : `${String(r.minimum)} ${r.product.unit}`}
                </div>
              ),
            },
            {
              key: 'replenishment',
              header: language === 'pt' ? 'Reposicao' : language === 'es' ? 'Reposicion' : 'Replenishment',
              sortValue: (r) => r.suggested,
              render: (r) => {
                if (!showReplenishment && (!r.below || !r.m)) return <div className="text-[var(--muted-foreground)]">-</div>
                const target = r.rt != null && r.rt > 0 ? r.rt : r.m
                return (
                  <div className="text-[var(--muted-foreground)]">
                    {r.suggested} {r.product.unit}
                    <span className="block text-xs text-[var(--text-muted)]">
                      {language === 'pt'
                        ? `falta ${r.shortage} | alvo ${target} ${r.product.unit}`
                        : language === 'es'
                          ? `faltan ${r.shortage} | objetivo ${target} ${r.product.unit}`
                          : `shortage ${r.shortage} | target ${target} ${r.product.unit}`}
                    </span>
                    {showReplenishment && r.economicSuggested > 0 ? (
                      <span className="block text-xs text-[var(--text-muted)]">
                        {language === 'pt'
                          ? `extra economico opcional ${r.economicSuggested} ${r.product.unit}`
                          : language === 'es'
                            ? `extra economico opcional ${r.economicSuggested} ${r.product.unit}`
                            : `optional economic extra ${r.economicSuggested} ${r.product.unit}`}
                      </span>
                    ) : null}
                    {showReplenishment ? (
                      <span className="block text-xs text-[var(--text-muted)]">
                        {r.coverageDays == null
                          ? language === 'pt'
                            ? 'sem consumo suficiente para calcular cobertura'
                            : language === 'es'
                              ? 'sin consumo suficiente para calcular cobertura'
                              : 'not enough consumption to calculate coverage'
                          : language === 'pt'
                            ? `${r.coverageDays.toFixed(1)}d cobertura | janela ${Number(r.purchaseWindowDays ?? 0).toFixed(0)}d`
                            : language === 'es'
                              ? `${r.coverageDays.toFixed(1)}d cobertura | ventana ${Number(r.purchaseWindowDays ?? 0).toFixed(0)}d`
                              : `${r.coverageDays.toFixed(1)}d coverage | window ${Number(r.purchaseWindowDays ?? 0).toFixed(0)}d`}
                        {r.daysToMinimum != null
                          ? language === 'pt'
                            ? ` | minimo em ${Math.max(0, r.daysToMinimum).toFixed(1)}d`
                            : language === 'es'
                              ? ` | minimo en ${Math.max(0, r.daysToMinimum).toFixed(1)}d`
                              : ` | min in ${Math.max(0, r.daysToMinimum).toFixed(1)}d`
                          : ''}
                      </span>
                    ) : null}
                    <span className="block text-xs text-[var(--text-muted)]">
                      {r.supplierMinOrderQty ? `${language === 'pt' ? 'lote min.' : language === 'es' ? 'lote min.' : 'min lot'} ${r.supplierMinOrderQty}` : ''}
                      {r.supplierMinOrderQty && r.supplierOrderMultiple ? ' | ' : ''}
                      {r.supplierOrderMultiple ? `${language === 'pt' ? 'multiplo' : language === 'es' ? 'multiplo' : 'multiple'} ${r.supplierOrderMultiple}` : ''}
                      {(r.supplierMinOrderQty || r.supplierOrderMultiple) && (r.effectiveLeadTimeDays ?? r.supplierLeadTimeDays) ? ' | ' : ''}
                      {r.effectiveLeadTimeDays != null
                        ? `${r.effectiveLeadTimeDays}d LT`
                        : r.supplierLeadTimeDays
                          ? `${r.supplierLeadTimeDays}d LT`
                          : ''}
                      {r.nextOrderInDays != null && r.nextOrderInDays > 0
                        ? `${(r.effectiveLeadTimeDays != null || r.supplierLeadTimeDays || r.supplierMinOrderQty || r.supplierOrderMultiple) ? ' | ' : ''}${
                            language === 'pt'
                              ? `pedido em ${r.nextOrderInDays}d`
                              : language === 'es'
                                ? `pedido en ${r.nextOrderInDays}d`
                                : `order in ${r.nextOrderInDays}d`
                          }`
                        : ''}
                      {r.nextOrderDate
                        ? `${(r.nextOrderInDays != null || r.effectiveLeadTimeDays != null || r.supplierLeadTimeDays || r.supplierMinOrderQty || r.supplierOrderMultiple) ? ' | ' : ''}${
                            language === 'pt'
                              ? `pedido ${r.nextOrderDate}`
                              : language === 'es'
                                ? `pedido ${r.nextOrderDate}`
                                : `order ${r.nextOrderDate}`
                          }`
                        : ''}
                      {r.expectedArrivalDate
                        ? `${r.nextOrderDate ? ' | ' : ''}${
                            language === 'pt'
                              ? `chega ${r.expectedArrivalDate}`
                              : language === 'es'
                                ? `llega ${r.expectedArrivalDate}`
                                : `arrives ${r.expectedArrivalDate}`
                          }`
                        : ''}
                    </span>
                  </div>
                )
              },
            },
            {
              key: 'avgCost',
              header: language === 'pt' ? 'Custo med.' : language === 'es' ? 'Costo prom.' : 'Avg cost',
              sortValue: (r) => Number(r.product.avgCost ?? 0),
              searchValue: (r) => (r.product.avgCost == null ? '' : String(r.product.avgCost)),
              render: (r) => {
                const v = r.product.avgCost == null ? null : Number(r.product.avgCost)
                if (!v || !Number.isFinite(v) || v <= 0) return <div className="text-[var(--muted-foreground)]">-</div>
                return <div className="text-[var(--muted-foreground)]">€ {v.toFixed(4)} / {r.product.unit}</div>
              },
            },
            {
              key: 'updated',
              header: language === 'pt' ? 'Atualizado' : language === 'es' ? 'Actualizado' : 'Updated',
              sortValue: (r) => new Date(r.updatedAt),
              render: (r) => (
                <div className="text-[var(--muted-foreground)]">
                  {new Date(r.updatedAt).toLocaleString()}
                </div>
              ),
            },
          ]}
        />
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-[var(--muted-foreground)]">
          {meta
            ? language === 'pt'
              ? `Mostrando ${rows.length} de ${meta.total}`
              : language === 'es'
                ? `Mostrando ${rows.length} de ${meta.total}`
                : `Showing ${rows.length} of ${meta.total}`
            : language === 'pt'
              ? 'Mostrando 0 de 0'
              : language === 'es'
                ? 'Mostrando 0 de 0'
                : 'Showing 0 of 0'}
        </div>

        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={!meta || meta.page <= 1}>
            {i.table.previous}
          </button>
          <div className="text-xs text-[var(--muted-foreground)]">
            {meta ? i.table.page.replace('{page}', String(meta.page)).replace('{pages}', String(meta.totalPages)) : i.table.page.replace('{page}', '1').replace('{pages}', '1')}
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setPage((p) => (meta ? Math.min(meta.totalPages, p + 1) : p + 1))}
            disabled={!meta || meta.page >= meta.totalPages}
          >
            {i.table.next}
          </button>
        </div>
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsOpen(false)} />
          <div className="surface modal-safe absolute bottom-0 left-0 right-0 mx-auto w-full max-w-2xl rounded-t-2xl border border-theme p-5 shadow-xl sm:bottom-auto sm:top-20 sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{i.inventory.editTitle}: {draft.productName}</h2>
                <p className="text-sm text-[var(--text-muted)]">{i.inventory.modalSubtitle}</p>
              </div>
              <button
                aria-label="Fechar"
                className="btn btn-secondary btn-icon"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                x
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1">
                <FieldLabel>
                  {i.inventory.quantityLabel} ({draft.unit})
                </FieldLabel>
                <div className="grid grid-cols-[1fr_86px] gap-2">
                  <input
                    value={draft.quantity}
                    onChange={(e) => setDraft((d) => ({ ...d, quantity: e.target.value }))}
                    className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                  />
                  <select
                    value={draft.inputUnit}
                    onChange={(e) => setDraft((d) => ({ ...d, inputUnit: e.target.value }))}
                    className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                    title="Unidade em que voce esta digitando (sera convertida para a unidade do produto)"
                  >
                    {(() => {
                      const base = draft.unit
                      const opts = base === 'gr' || base === 'g' ? ['gr', 'kg'] : base === 'kg' ? ['kg', 'gr'] : base === 'ml' ? ['ml', 'l'] : base === 'l' ? ['l', 'ml'] : base === 'un' ? ['un', 'dz'] : base === 'dz' ? ['dz', 'un'] : base ? [base] : []
                      return opts.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))
                    })()}
                  </select>
                </div>
              </label>

              <div className="rounded-lg border border-theme bg-[var(--surface-2)] p-3">
                <div className="text-sm font-medium text-[var(--foreground)]">
                  {language === 'pt' ? 'Ajuste formal de estoque' : language === 'es' ? 'Ajuste formal de inventario' : 'Formal inventory adjustment'}
                </div>
                <div className="mt-1 text-xs text-[var(--text-muted)]">
                  {language === 'pt'
                    ? 'Se a quantidade for alterada, registre o motivo do ajuste para manter a trilha operacional.'
                    : language === 'es'
                      ? 'Si cambias la cantidad, registra el motivo del ajuste para mantener la trazabilidad.'
                      : 'If quantity changes, record the adjustment reason to keep an operational trail.'}
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-xs font-medium text-[var(--foreground)]">
                      {language === 'pt' ? 'Motivo do ajuste' : language === 'es' ? 'Motivo del ajuste' : 'Adjustment reason'}
                    </span>
                    <select
                      value={draft.adjustmentReason}
                      onChange={(e) => setDraft((d) => ({ ...d, adjustmentReason: e.target.value as Draft['adjustmentReason'] }))}
                      className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                    >
                      <option value="COUNT">{language === 'pt' ? 'Contagem/inventario' : language === 'es' ? 'Conteo/inventario' : 'Count/inventory'}</option>
                      <option value="LOSS">{language === 'pt' ? 'Perda' : language === 'es' ? 'Perdida' : 'Loss'}</option>
                      <option value="DAMAGE">{language === 'pt' ? 'Avaria' : language === 'es' ? 'Averia' : 'Damage'}</option>
                      <option value="EXPIRATION">{language === 'pt' ? 'Validade vencida' : language === 'es' ? 'Caducidad vencida' : 'Expiration'}</option>
                      <option value="CORRECTION">{language === 'pt' ? 'Correcao operacional' : language === 'es' ? 'Correccion operativa' : 'Operational correction'}</option>
                      <option value="RETURN">{language === 'pt' ? 'Retorno' : language === 'es' ? 'Retorno' : 'Return'}</option>
                      <option value="OTHER">{language === 'pt' ? 'Outro' : language === 'es' ? 'Otro' : 'Other'}</option>
                    </select>
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs font-medium text-[var(--foreground)]">
                      {language === 'pt' ? 'Observacao do ajuste' : language === 'es' ? 'Observacion del ajuste' : 'Adjustment note'}
                    </span>
                    <textarea
                      value={draft.adjustmentNote}
                      onChange={(e) => setDraft((d) => ({ ...d, adjustmentNote: e.target.value }))}
                      placeholder={
                        language === 'pt'
                          ? 'Opcional. Ex.: contagem de fechamento, quebra, correcao de saldo...'
                          : language === 'es'
                            ? 'Opcional. Ej.: conteo de cierre, merma, correccion de saldo...'
                            : 'Optional. Ex.: closing count, shrinkage, balance correction...'
                      }
                      className="min-h-24 w-full rounded-lg border border-theme bg-transparent px-3 py-2 text-sm"
                    />
                  </label>
                </div>
              </div>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-[var(--foreground)]">{i.inventory.minimumLabel} ({draft.unit})</span>
                <div className="grid grid-cols-[1fr_86px] gap-2">
                  <input
                    value={draft.minimum}
                    onChange={(e) => setDraft((d) => ({ ...d, minimum: e.target.value }))}
                    placeholder={i.modal.optional}
                    className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                  />
                  <select
                    value={draft.inputUnit}
                    onChange={(e) => setDraft((d) => ({ ...d, inputUnit: e.target.value }))}
                    className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                    title="Unidade em que voce esta digitando (sera convertida para a unidade do produto)"
                  >
                    {(() => {
                      const base = draft.unit
                      const opts = base === 'gr' || base === 'g' ? ['gr', 'kg'] : base === 'kg' ? ['kg', 'gr'] : base === 'ml' ? ['ml', 'l'] : base === 'l' ? ['l', 'ml'] : base === 'un' ? ['un', 'dz'] : base === 'dz' ? ['dz', 'un'] : base ? [base] : []
                      return opts.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))
                    })()}
                  </select>
                </div>
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-[var(--foreground)]">
                  {language === 'pt' ? 'Alvo de reposicao' : language === 'es' ? 'Objetivo de reposicion' : 'Reorder target'} ({draft.unit})
                </span>
                <div className="grid grid-cols-[1fr_86px] gap-2">
                  <input
                    value={draft.reorderTarget}
                    onChange={(e) => setDraft((d) => ({ ...d, reorderTarget: e.target.value }))}
                    placeholder={i.modal.optional}
                    className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                  />
                  <select
                    value={draft.inputUnit}
                    onChange={(e) => setDraft((d) => ({ ...d, inputUnit: e.target.value }))}
                    className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                    title="Unidade em que voce esta digitando"
                  >
                    {(() => {
                      const base = draft.unit
                      const opts = base === 'gr' || base === 'g' ? ['gr', 'kg'] : base === 'kg' ? ['kg', 'gr'] : base === 'ml' ? ['ml', 'l'] : base === 'l' ? ['l', 'ml'] : base === 'un' ? ['un', 'dz'] : base === 'dz' ? ['dz', 'un'] : base ? [base] : []
                      return opts.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))
                    })()}
                  </select>
                </div>
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-[var(--foreground)]">
                  {language === 'pt' ? 'Criticidade do item' : language === 'es' ? 'Criticidad del item' : 'Item criticality'}
                </span>
                <select
                  value={draft.criticality}
                  onChange={(e) => setDraft((d) => ({ ...d, criticality: e.target.value as Draft['criticality'] }))}
                  className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                >
                  <option value="LOW">{language === 'pt' ? 'Baixa' : language === 'es' ? 'Baja' : 'Low'}</option>
                  <option value="MEDIUM">{language === 'pt' ? 'Media' : language === 'es' ? 'Media' : 'Medium'}</option>
                  <option value="HIGH">{language === 'pt' ? 'Alta' : language === 'es' ? 'Alta' : 'High'}</option>
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-[var(--foreground)]">
                  {language === 'pt' ? 'Fornecedor preferencial' : language === 'es' ? 'Proveedor preferente' : 'Preferred supplier'}
                </span>
                <select
                  value={draft.preferredSupplierId}
                  onChange={(e) => setDraft((d) => ({ ...d, preferredSupplierId: e.target.value }))}
                  className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                >
                  <option value="">{language === 'pt' ? 'Nao definido' : language === 'es' ? 'Sin definir' : 'Not set'}</option>
                  {(suppliersQ.data?.suppliers ?? []).map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-[var(--foreground)]">
                    {language === 'pt' ? 'Lead time (dias)' : language === 'es' ? 'Lead time (dias)' : 'Lead time (days)'}
                  </span>
                  <input
                    value={draft.supplierLeadTimeDays}
                    onChange={(e) => setDraft((d) => ({ ...d, supplierLeadTimeDays: e.target.value }))}
                    placeholder="0"
                    className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                    inputMode="numeric"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-[var(--foreground)]">
                    {language === 'pt' ? 'Lote minimo' : language === 'es' ? 'Lote minimo' : 'Min order qty'} ({draft.unit})
                  </span>
                  <input
                    value={draft.supplierMinOrderQty}
                    onChange={(e) => setDraft((d) => ({ ...d, supplierMinOrderQty: e.target.value }))}
                    placeholder={i.modal.optional}
                    className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-[var(--foreground)]">
                    {language === 'pt' ? 'Multiplo de compra' : language === 'es' ? 'Multiplo de compra' : 'Order multiple'} ({draft.unit})
                  </span>
                  <input
                    value={draft.supplierOrderMultiple}
                    onChange={(e) => setDraft((d) => ({ ...d, supplierOrderMultiple: e.target.value }))}
                    placeholder={i.modal.optional}
                    className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                  />
                </label>
              </div>

              <div className="rounded-lg border border-theme p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-[var(--foreground)]">
                      {locationUi.balanceByLocation}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {locationUi.balanceHelp}
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid gap-2">
                  {(locationsQ.data?.locations ?? []).map((location) => (
                    <div key={location.id} className="flex items-center justify-between rounded-lg border border-theme px-3 py-2 text-sm">
                      <div>
                        <div className="font-medium">
                          {location.name}
                          {location.isDefault ? (
                            <span className="ml-2 badge badge-solid">{locationUi.defaultLocation}</span>
                          ) : null}
                        </div>
                        <div className="text-[var(--text-muted)]">{location.code}</div>
                      </div>
                      <div className="text-[var(--muted-foreground)]">
                        {String(location.quantity)} {draft.unit}
                      </div>
                    </div>
                  ))}
                  {!locationsQ.isLoading && (locationsQ.data?.locations?.length ?? 0) === 0 ? (
                    <div className="text-sm text-[var(--text-muted)]">
                      {locationUi.noLocationBalances}
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-2 border-t border-theme pt-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-[var(--foreground)]">
                        {language === 'pt' ? 'Contagem formal' : language === 'es' ? 'Conteo formal' : 'Formal count'}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {language === 'pt'
                          ? 'Use este fluxo para registrar a contagem fisica sem misturar com a edicao geral do item.'
                          : language === 'es'
                            ? 'Usa este flujo para registrar el conteo fisico sin mezclarlo con la edicion general del item.'
                            : 'Use this flow to register the physical count without mixing it with general item editing.'}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setCountDraft({ countedQuantity: draft.quantity || '0', note: '' })
                        setIsCountModalOpen(true)
                      }}
                    >
                      {language === 'pt' ? 'Registrar contagem' : language === 'es' ? 'Registrar conteo' : 'Register count'}
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 border-t border-theme pt-3">
                  <div className="text-sm font-medium text-[var(--foreground)]">
                    {locationUi.transferStock}
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <select
                      value={transferDraft.fromWarehouseId}
                      onChange={(e) => setTransferDraft((d) => ({ ...d, fromWarehouseId: e.target.value }))}
                      className="w-full rounded-lg border border-theme bg-transparent px-3 py-2 text-sm"
                    >
                      <option value="">{locationUi.source}</option>
                      {(locationsQ.data?.locations ?? []).map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={transferDraft.toWarehouseId}
                      onChange={(e) => setTransferDraft((d) => ({ ...d, toWarehouseId: e.target.value }))}
                      className="w-full rounded-lg border border-theme bg-transparent px-3 py-2 text-sm"
                    >
                      <option value="">{locationUi.destination}</option>
                      {(warehousesQ.data?.warehouses ?? []).map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>
                          {warehouse.name}
                        </option>
                        ))}
                    </select>
                  </div>
                  <select
                    value={transferDraft.sourceLotId}
                    onChange={(e) => setTransferDraft((d) => ({ ...d, sourceLotId: e.target.value }))}
                    className="w-full rounded-lg border border-theme bg-transparent px-3 py-2 text-sm"
                  >
                    <option value="">{language === 'pt' ? 'Qualquer lote (FIFO)' : language === 'es' ? 'Cualquier lote (FIFO)' : 'Any lot (FIFO)'}</option>
                    {(lotsQ.data?.lots ?? [])
                      .filter((lot) => !transferDraft.fromWarehouseId || lot.warehouseId === transferDraft.fromWarehouseId)
                      .map((lot) => (
                        <option key={lot.id} value={lot.id}>
                          {lot.lotCode}
                          {lot.expiresAt ? ` • ${new Date(lot.expiresAt).toLocaleDateString()}` : ''}
                          {` • ${Number(lot.quantity ?? 0)} ${draft.unit}`}
                        </option>
                      ))}
                  </select>
                  <input
                    value={transferDraft.quantity}
                    onChange={(e) => setTransferDraft((d) => ({ ...d, quantity: e.target.value }))}
                    placeholder={language === 'pt' ? `Quantidade (${draft.inputUnit || draft.unit})` : language === 'es' ? `Cantidad (${draft.inputUnit || draft.unit})` : `Quantity (${draft.inputUnit || draft.unit})`}
                    className="w-full rounded-lg border border-theme bg-transparent px-3 py-2 text-sm"
                  />
                  <textarea
                    value={transferDraft.observations}
                    onChange={(e) => setTransferDraft((d) => ({ ...d, observations: e.target.value }))}
                    placeholder={locationUi.transferNote}
                    className="min-h-20 w-full rounded-lg border border-theme bg-transparent px-3 py-2 text-sm"
                  />
                  <div className="flex justify-end">
                    <button type="button" className="btn btn-secondary" onClick={() => void transferStock()} disabled={transferM.isPending}>
                      {locationUi.transferStock}
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 border-t border-theme pt-3">
                  <div className="text-sm font-medium text-[var(--foreground)]">{locationUi.lotsTitle}</div>
                  {lotsQ.isLoading ? (
                    <div className="text-sm text-[var(--text-muted)]">{i.common.loading}</div>
                  ) : (lotsQ.data?.lots?.length ?? 0) === 0 ? (
                    <div className="text-sm text-[var(--text-muted)]">{locationUi.lotsEmpty}</div>
                  ) : (
                    <div className="grid gap-2">
                      {(lotsQ.data?.lots ?? []).map((lot) => (
                        <div key={lot.id} className="rounded-lg border border-theme px-3 py-2 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="font-medium">{lot.lotCode}</div>
                            <div className="text-[var(--muted-foreground)]">
                              {Number(lot.quantity ?? 0)} {draft.unit}
                            </div>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
                            {lot.expiresAt ? (
                              <span>
                                {language === 'pt' ? 'validade' : language === 'es' ? 'caducidad' : 'expiry'}: {new Date(lot.expiresAt).toLocaleDateString()}
                              </span>
                            ) : null}
                            {(lot.serialCodes?.length ?? 0) > 0 ? (
                              <span>{lot.serialCodes?.length} {language === 'pt' ? 'seriais' : language === 'es' ? 'seriales' : 'serials'}</span>
                            ) : null}
                            {lot.warehouseName ? <span>{lot.warehouseName}</span> : null}
                            {lot.supplierName ? <span>{lot.supplierName}</span> : null}
                            <span>{new Date(lot.receivedAt).toLocaleDateString()}</span>
                          </div>
                          {lot.notes ? <div className="mt-1 text-xs text-[var(--text-muted)]">{lot.notes}</div> : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-4 grid gap-2 border-t border-theme pt-3">
                  <div className="text-sm font-medium text-[var(--foreground)]">{locationUi.movementHistory}</div>
                  {movementsQ.isLoading ? (
                    <div className="text-sm text-[var(--text-muted)]">{i.common.loading}</div>
                  ) : (movementsQ.data?.movements?.length ?? 0) === 0 ? (
                    <div className="text-sm text-[var(--text-muted)]">{locationUi.movementEmpty}</div>
                  ) : (
                    <div className="grid gap-2">
                      {(movementsQ.data?.movements ?? []).map((movement) => {
                        const qty = Number(movement.quantity ?? 0)
                        const balanceAfterGlobal =
                          movement.balanceAfterGlobal == null ? null : Number(movement.balanceAfterGlobal)
                        return (
                          <div key={movement.id} className="rounded-lg border border-theme px-3 py-2 text-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="font-medium">{movementTypeLabel(movement.movementType)}</div>
                              <div className={qty >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                                {qty >= 0 ? '+' : ''}
                                {qty} {draft.unit}
                              </div>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
                              <span>{new Date(movement.createdAt).toLocaleString()}</span>
                              {movement.warehouse?.name ? <span>{movement.warehouse.name}</span> : null}
                              {balanceAfterGlobal != null ? <span>saldo: {balanceAfterGlobal} {draft.unit}</span> : null}
                            </div>
                            {movement.observations ? (
                              <div className="mt-1 text-xs text-[var(--text-muted)]">{movement.observations}</div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="mt-4 grid gap-2 border-t border-theme pt-3">
                  <div className="text-sm font-medium text-[var(--foreground)]">
                    {language === 'pt' ? 'Rastreabilidade por lote/documento' : language === 'es' ? 'Trazabilidad por lote/documento' : 'Lot/document traceability'}
                  </div>
                  {traceQ.isLoading ? (
                    <div className="text-sm text-[var(--text-muted)]">{i.common.loading}</div>
                  ) : (traceQ.data?.events?.length ?? 0) === 0 ? (
                    <div className="text-sm text-[var(--text-muted)]">
                      {language === 'pt' ? 'Sem eventos rastreaveis ainda.' : language === 'es' ? 'Aun no hay eventos trazables.' : 'No traceable events yet.'}
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      {(traceQ.data?.events ?? []).map((event) => {
                        const qty = Number(event.quantity ?? 0)
                        return (
                          <div key={event.id} className="rounded-lg border border-theme px-3 py-2 text-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="font-medium">
                                {event.eventType}
                                {event.lotCode ? ` • ${event.lotCode}` : ''}
                              </div>
                              <div className={qty >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                                {qty >= 0 ? '+' : ''}
                                {qty} {draft.unit}
                              </div>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
                              <span>{new Date(event.createdAt).toLocaleString()}</span>
                              {event.referenceType && event.referenceId ? <span>{event.referenceType}: {event.referenceId.slice(0, 8)}</span> : null}
                              {event.warehouseName ? <span>{event.warehouseName}</span> : null}
                              {(event.serialCodes?.length ?? 0) > 0 ? <span>{event.serialCodes?.length} {language === 'pt' ? 'seriais' : language === 'es' ? 'seriales' : 'serials'}</span> : null}
                            </div>
                            {event.notes ? <div className="mt-1 text-xs text-[var(--text-muted)]">{event.notes}</div> : null}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
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
                disabled={updateM.isPending}
              >
                {i.modal.save}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isWarehouseModalOpen ? (
        <div className="modal-overlay-center z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsWarehouseModalOpen(false)} />
          <div className="surface modal-safe relative z-10 w-full max-w-xl rounded-2xl border border-theme p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{locationUi.newLocationTitle}</h2>
                <p className="text-sm text-[var(--text-muted)]">{locationUi.newLocationSubtitle}</p>
              </div>
              <button type="button" className="btn btn-secondary btn-icon" onClick={() => setIsWarehouseModalOpen(false)} aria-label="Close">
                x
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1">
                <FieldLabel>{locationUi.locationName}</FieldLabel>
                <input
                  value={warehouseDraft.name}
                  onChange={(e) => setWarehouseDraft((d) => ({ ...d, name: e.target.value }))}
                  className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                  autoFocus
                />
              </label>

              <label className="grid gap-1">
                <FieldLabel>{locationUi.locationCode}</FieldLabel>
                <input
                  value={warehouseDraft.code}
                  onChange={(e) => setWarehouseDraft((d) => ({ ...d, code: e.target.value }))}
                  placeholder={i.modal.optional}
                  className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                />
                <span className="text-xs text-[var(--text-muted)]">{locationUi.locationCodeHelp}</span>
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button className="btn btn-secondary" onClick={() => setIsWarehouseModalOpen(false)} type="button">
                {i.modal.cancel}
              </button>
              <button
                className="btn btn-primary"
                onClick={() => void saveWarehouseQuick()}
                type="button"
                disabled={!warehouseDraft.name.trim() || createWarehouseM.isPending}
              >
                {i.modal.save}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isCountModalOpen ? (
        <div className="modal-overlay-center z-[60]">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsCountModalOpen(false)} />
          <div className="surface modal-safe relative z-10 w-full max-w-xl rounded-2xl border border-theme p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">
                  {language === 'pt' ? 'Registrar contagem' : language === 'es' ? 'Registrar conteo' : 'Register stock count'}
                </h2>
                <p className="text-sm text-[var(--text-muted)]">{draft.productName}</p>
              </div>
              <button type="button" className="btn btn-secondary btn-icon" onClick={() => setIsCountModalOpen(false)} aria-label="Close">
                x
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="rounded-lg border border-theme bg-[var(--surface-2)] p-3 text-sm">
                <div className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                  {language === 'pt' ? 'Saldo atual no sistema' : language === 'es' ? 'Saldo actual en el sistema' : 'Current system balance'}
                </div>
                <div className="mt-1 font-medium">
                  {draft.quantity || '0'} {draft.unit}
                </div>
              </div>

              <label className="grid gap-1">
                <FieldLabel>
                  {language === 'pt' ? 'Quantidade contada' : language === 'es' ? 'Cantidad contada' : 'Counted quantity'} ({draft.unit})
                </FieldLabel>
                <input
                  value={countDraft.countedQuantity}
                  onChange={(e) => setCountDraft((current) => ({ ...current, countedQuantity: e.target.value }))}
                  className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                  inputMode="decimal"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-[var(--foreground)]">
                  {language === 'pt' ? 'Observacao da contagem' : language === 'es' ? 'Observacion del conteo' : 'Count note'}
                </span>
                <textarea
                  value={countDraft.note}
                  onChange={(e) => setCountDraft((current) => ({ ...current, note: e.target.value }))}
                  placeholder={
                    language === 'pt'
                      ? 'Ex.: contagem de fechamento, inventario ciclico, diferenca encontrada...'
                      : language === 'es'
                        ? 'Ej.: conteo de cierre, inventario ciclico, diferencia encontrada...'
                        : 'Ex.: closing count, cycle count, variance found...'
                  }
                  className="min-h-24 w-full rounded-lg border border-theme bg-transparent px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button className="btn btn-secondary" onClick={() => setIsCountModalOpen(false)} type="button">
                {i.modal.cancel}
              </button>
              <button className="btn btn-primary" onClick={() => void saveCount()} type="button" disabled={updateM.isPending}>
                {language === 'pt' ? 'Confirmar contagem' : language === 'es' ? 'Confirmar conteo' : 'Confirm count'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

