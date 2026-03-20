// Client-side fetch helper used across protected pages.
// Redirects to /login when the backend returns 401 (session expired).

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      const next = window.location.pathname + window.location.search + window.location.hash
      const u = new URL('/login', window.location.origin)
      u.searchParams.set('next', next)
      window.location.href = u.toString()
    }
    throw new Error('UNAUTHORIZED')
  }

  if (!res.ok) throw new Error(await res.text())
  return (await res.json()) as T
}
