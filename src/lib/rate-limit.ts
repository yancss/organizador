type RateLimitResult = {
  ok: boolean
  remaining: number
  resetAt: number
  limit: number
  source: 'memory' | 'upstash'
}

type Bucket = {
  n: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

function nowMs() {
  return Date.now()
}

function getUpstashConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) return null
  return { url: url.replace(/\/$/, ''), token }
}

function memoryHit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = nowMs()
  const bucket = buckets.get(key)

  if (!bucket || now >= bucket.resetAt) {
    const resetAt = now + windowMs
    buckets.set(key, { n: 1, resetAt })
    return { ok: true, remaining: limit - 1, resetAt, limit, source: 'memory' }
  }

  if (bucket.n >= limit) {
    return { ok: false, remaining: 0, resetAt: bucket.resetAt, limit, source: 'memory' }
  }

  bucket.n += 1
  return { ok: true, remaining: Math.max(0, limit - bucket.n), resetAt: bucket.resetAt, limit, source: 'memory' }
}

async function upstashHit(key: string, limit: number, windowMs: number): Promise<RateLimitResult | null> {
  const cfg = getUpstashConfig()
  if (!cfg) return null

  const now = nowMs()
  const redisKey = `ratelimit:${key}`

  const res = await fetch(`${cfg.url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([
      ['INCR', redisKey],
      ['PEXPIRE', redisKey, windowMs, 'NX'],
      ['PTTL', redisKey],
    ]),
    cache: 'no-store',
  }).catch(() => null)

  if (!res?.ok) return null

  const payload = (await res.json().catch(() => null)) as
    | Array<{ result?: unknown }>
    | null

  if (!Array.isArray(payload) || payload.length < 3) return null

  const count = Number(payload[0]?.result ?? 0)
  const ttl = Number(payload[2]?.result ?? windowMs)

  if (!Number.isFinite(count) || count <= 0) return null

  const resetAt = now + Math.max(1, ttl)
  return {
    ok: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt,
    limit,
    source: 'upstash',
  }
}

export async function hitRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const distributed = await upstashHit(key, limit, windowMs)
  if (distributed) return distributed
  return memoryHit(key, limit, windowMs)
}
