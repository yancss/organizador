export type SupplierWeekday =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY'

const WEEKDAY_TO_JS_DAY: Record<SupplierWeekday, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

function addDays(value: Date, days: number) {
  const next = new Date(value)
  next.setDate(next.getDate() + days)
  return next
}

function formatDateKey(value: Date) {
  const y = value.getFullYear()
  const m = String(value.getMonth() + 1).padStart(2, '0')
  const d = String(value.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function diffCalendarDays(from: Date, to: Date) {
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.max(0, Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / msPerDay))
}

function daysUntilNextWeekday(from: Date, weekdays: SupplierWeekday[]) {
  if (!weekdays.length) return 0
  const day = from.getDay()
  const distances = weekdays.map((weekday) => {
    const target = WEEKDAY_TO_JS_DAY[weekday]
    return (target - day + 7) % 7
  })
  return Math.min(...distances)
}

export function computeSupplierCalendarLeadTime(args: {
  baseLeadTimeDays?: number | null
  orderDays?: SupplierWeekday[] | null
  deliveryDays?: SupplierWeekday[] | null
  cutoffHour?: number | null
  blockedDates?: string[] | null
  now?: Date
}) {
  const now = args.now ?? new Date()
  const blocked = new Set((args.blockedDates ?? []).filter(Boolean))
  const cutoffHour = args.cutoffHour != null && args.cutoffHour >= 0 && args.cutoffHour <= 23 ? args.cutoffHour : null
  const baseLeadTimeDays = Math.max(0, args.baseLeadTimeDays ?? 0)
  const orderDays = args.orderDays ?? []
  const deliveryDays = args.deliveryDays ?? []

  let orderDate = startOfDay(now)
  if (cutoffHour != null && now.getHours() >= cutoffHour) {
    orderDate = addDays(orderDate, 1)
  }
  orderDate = addDays(orderDate, daysUntilNextWeekday(orderDate, orderDays))
  while (blocked.has(formatDateKey(orderDate))) {
    orderDate = addDays(orderDate, 1)
    orderDate = addDays(orderDate, daysUntilNextWeekday(orderDate, orderDays))
  }

  let arrivalDate = addDays(orderDate, baseLeadTimeDays)
  arrivalDate = addDays(arrivalDate, daysUntilNextWeekday(arrivalDate, deliveryDays))
  while (blocked.has(formatDateKey(arrivalDate))) {
    arrivalDate = addDays(arrivalDate, 1)
    arrivalDate = addDays(arrivalDate, daysUntilNextWeekday(arrivalDate, deliveryDays))
  }

  const nextOrderInDays = diffCalendarDays(now, orderDate)
  const deliveryOffset = Math.max(0, diffCalendarDays(orderDate, arrivalDate) - baseLeadTimeDays)
  const effectiveLeadTimeDays = diffCalendarDays(now, arrivalDate)

  return {
    nextOrderInDays,
    deliveryOffsetDays: deliveryOffset,
    effectiveLeadTimeDays,
    nextOrderDate: formatDateKey(orderDate),
    expectedArrivalDate: formatDateKey(arrivalDate),
  }
}

export function computePurchaseSuggestion(args: {
  quantity: number
  minimum: number | null
  reorderTarget: number | null
  minOrderQty?: number | null
  orderMultiple?: number | null
}) {
  const { quantity, minimum, reorderTarget, minOrderQty, orderMultiple } = args
  const target = reorderTarget != null && reorderTarget > 0 ? reorderTarget : minimum
  const shortage = minimum != null && target != null && quantity < minimum ? Math.max(0, target - quantity) : 0

  let purchaseQty = shortage
  if (purchaseQty > 0 && minOrderQty != null && minOrderQty > 0) {
    purchaseQty = Math.max(purchaseQty, minOrderQty)
  }
  if (purchaseQty > 0 && orderMultiple != null && orderMultiple > 0) {
    purchaseQty = Math.ceil(purchaseQty / orderMultiple) * orderMultiple
  }

  return {
    target,
    shortage,
    purchaseQty,
  }
}

export function computeForecastedPurchaseSuggestion(args: {
  quantity: number
  minimum: number | null
  reorderTarget: number | null
  avgDailyConsumption: number
  leadTimeDays?: number | null
  minOrderQty?: number | null
  orderMultiple?: number | null
}) {
  const leadTimeDays = args.leadTimeDays != null && args.leadTimeDays > 0 ? args.leadTimeDays : 0
  const planningBufferDays = leadTimeDays > 0 ? 3 : 0
  const purchaseWindowDays = leadTimeDays + planningBufferDays
  const target = args.reorderTarget != null && args.reorderTarget > 0 ? args.reorderTarget : args.minimum
  const currentShortage = args.minimum != null && target != null && args.quantity < args.minimum ? Math.max(0, target - args.quantity) : 0
  const projectedQtyAtLeadTime = Math.max(0, args.quantity - args.avgDailyConsumption * leadTimeDays)
  const forecastShortage = args.minimum != null && target != null && projectedQtyAtLeadTime < args.minimum ? Math.max(0, target - projectedQtyAtLeadTime) : 0
  const daily = args.avgDailyConsumption > 0 ? args.avgDailyConsumption : 0
  const coverageDays = daily > 0 ? args.quantity / daily : null
  const daysToMinimum = daily > 0 && args.minimum != null ? (args.quantity - args.minimum) / daily : null
  const isInPurchaseWindow =
    target != null &&
    target > args.quantity &&
    purchaseWindowDays > 0 &&
    daysToMinimum != null &&
    daysToMinimum <= purchaseWindowDays
  const windowPurchaseQty = isInPurchaseWindow && target != null ? Math.max(0, target - args.quantity) : 0
  const basePurchaseQty = Math.max(currentShortage, forecastShortage, windowPurchaseQty)

  let purchaseQty = basePurchaseQty
  if (purchaseQty > 0 && args.minOrderQty != null && args.minOrderQty > 0) {
    purchaseQty = Math.max(purchaseQty, args.minOrderQty)
  }
  if (purchaseQty > 0 && args.orderMultiple != null && args.orderMultiple > 0) {
    purchaseQty = Math.ceil(purchaseQty / args.orderMultiple) * args.orderMultiple
  }

  let riskLevel: 'urgent' | 'soon' | 'watch' | 'stable' = 'stable'
  let riskScore = 0
  if (currentShortage > 0 || forecastShortage > 0 && leadTimeDays > 0) {
    riskLevel = 'urgent'
    riskScore = 3
  } else if (isInPurchaseWindow) {
    riskLevel = 'soon'
    riskScore = 2
  } else if (daysToMinimum != null && daysToMinimum <= purchaseWindowDays + 14) {
    riskLevel = 'watch'
    riskScore = 1
  }

  return {
    target,
    currentShortage,
    projectedQtyAtLeadTime,
    forecastShortage,
    coverageDays,
    purchaseQty,
    daysToMinimum,
    purchaseWindowDays,
    isInPurchaseWindow,
    riskLevel,
    riskScore,
  }
}
