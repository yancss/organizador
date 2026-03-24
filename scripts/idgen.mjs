// Deterministic ID generator for DEV/seed data.
// Format: <PREFIX><10-digit sequence>, e.g. WS0000000001

const seqByPrefix = new Map()

export function makeId(prefix) {
  if (!prefix || typeof prefix !== 'string') throw new Error('prefix required')
  const p = prefix.toUpperCase()
  const next = (seqByPrefix.get(p) ?? 0) + 1
  seqByPrefix.set(p, next)
  return p + String(next).padStart(10, '0')
}

export function resetIdSeq() {
  seqByPrefix.clear()
}
