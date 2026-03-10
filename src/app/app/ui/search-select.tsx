'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type Item = { id: string; label: string }

export type SearchSelectLabels = {
  placeholder: string
  empty: string
  hint: string
  loading: string
  clear?: string
}

export default function SearchSelect({
  value,
  onChange,
  fetcher,
  labels,
  minChars = 2,
}: {
  value: Item | null
  onChange: (next: Item | null) => void
  fetcher: (q: string) => Promise<Item[]>
  labels: SearchSelectLabels
  minChars?: number
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const ref = useRef<HTMLDivElement | null>(null)

  // Close on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  // Debounced fetch
  useEffect(() => {
    if (!open) return
    if (q.trim().length < minChars) {
      setItems([])
      setLoading(false)
      return
    }

    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetcher(q.trim())
        setItems(res)
      } finally {
        setLoading(false)
      }
    }, 250)

    return () => clearTimeout(t)
  }, [q, open, minChars, fetcher])

  const display = useMemo(() => value?.label ?? '', [value])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-theme bg-transparent px-3 py-2 text-left"
      >
        <span className={display ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'}>
          {display || labels.placeholder}
        </span>
        <span className="text-[var(--muted-foreground)]">▾</span>
      </button>

      {open ? (
        <div className="surface absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-theme shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
          <div className="p-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={labels.placeholder}
              className="w-full rounded-lg border border-theme bg-transparent px-3 py-2 text-sm"
              autoFocus
            />
            <div className="mt-2 text-xs text-[var(--muted-foreground)]">
              {q.trim().length < minChars ? labels.hint : loading ? labels.loading : ''}
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto border-t border-theme">
            {q.trim().length < minChars ? null : loading ? null : items.length === 0 ? (
              <div className="p-3 text-sm text-[var(--muted-foreground)]">{labels.empty}</div>
            ) : (
              <ul>
                {items.map((it) => (
                  <li key={it.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--muted)]"
                      onClick={() => {
                        onChange(it)
                        setOpen(false)
                        setQ('')
                      }}
                    >
                      <span>{it.label}</span>
                      {value?.id === it.id ? <span className="text-xs text-[var(--muted-foreground)]">✓</span> : null}
                    </button>
                  </li>
                ))}

                <li className="border-t border-theme">
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm text-[var(--danger)] hover:bg-[var(--danger-bg)]"
                    onClick={() => {
                      onChange(null)
                      setOpen(false)
                      setQ('')
                    }}
                  >
                    {labels.clear ?? 'Limpar seleção'}
                  </button>
                </li>
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
