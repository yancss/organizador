export const DEFAULT_EXPORT_MAX_ROWS = 1000

export function getExportMaxRows() {
  const raw = Number(process.env.EXPORT_MAX_ROWS ?? DEFAULT_EXPORT_MAX_ROWS)
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_EXPORT_MAX_ROWS
  return Math.min(5000, Math.floor(raw))
}
