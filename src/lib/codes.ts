import { randomBytes } from 'crypto'

function yyyymmdd(d = new Date()) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}${mm}${dd}`
}

/**
 * Human-friendly code safe for URLs and PDFs.
 * Not strictly sequential (avoids race conditions in serverless).
 */
export function makeDocCode(prefix: 'SO' | 'PO', now = new Date()) {
  const rand = randomBytes(2).toString('hex').toUpperCase() // 4 chars
  return `${prefix}-${yyyymmdd(now)}-${rand}`
}
