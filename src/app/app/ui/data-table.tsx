'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'

export type SortDir = 'asc' | 'desc'

export type ColumnDef<T> = {
  key: string
  header: string
  className?: string
  headerClassName?: string
  /**
   * Value used for sorting. If omitted, this column won't be sortable.
   */
  sortValue?: (row: T) => string | number | boolean | null | undefined | Date
  /**
   * Value used for search filtering. If omitted, this column is ignored by search.
   */
  searchValue?: (row: T) => string | null | undefined
  render: (row: T) => React.ReactNode
}

function normalize(v: any): string | number {
  if (v == null) return ''
  if (v instanceof Date) return v.getTime()
  if (typeof v === 'boolean') return v ? 1 : 0
  return v
}

export type DataTableLabels = {
  showing: string // placeholders: {start} {end} {total}
  page: string // placeholders: {page} {pages}
  previous: string
  next: string
  searchPlaceholder: string
  clear: string
  noResults: string
}

function fmt(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))
}

export default function DataTable<T>({
  rows,
  columns,
  empty,
  initialSort,
  onRowClick,
  pageSize = 10,
  labels = {
    showing: 'Mostrando {start}–{end} de {total}',
    page: 'Página {page} / {pages}',
    previous: 'Anterior',
    next: 'Próxima',
    searchPlaceholder: 'Buscar…',
    clear: 'Limpar',
    noResults: 'Nenhum registro encontrado para a busca.',
  },
}: {
  rows: T[]
  columns: ColumnDef<T>[]
  empty: React.ReactNode
  initialSort?: { key: string; dir?: SortDir }
  onRowClick?: (row: T) => void
  pageSize?: number
  labels?: DataTableLabels
}) {
  const [sortKey, setSortKey] = useState<string | null>(initialSort?.key ?? null)
  const [sortDir, setSortDir] = useState<SortDir>(initialSort?.dir ?? 'asc')
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')

  const colByKey = useMemo(() => {
    const m = new Map<string, ColumnDef<T>>()
    for (const c of columns) m.set(c.key, c)
    return m
  }, [columns])

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows

    const searchable = columns.filter((c) => typeof c.searchValue === 'function')
    if (searchable.length === 0) return rows

    return rows.filter((r) => {
      for (const c of searchable) {
        const v = c.searchValue?.(r)
        if (!v) continue
        if (String(v).toLowerCase().includes(q)) return true
      }
      return false
    })
  }, [rows, query, columns])

  const sortedRows = useMemo(() => {
    if (!sortKey) return filteredRows
    const col = colByKey.get(sortKey)
    if (!col?.sortValue) return filteredRows

    const dir = sortDir
    const items = [...filteredRows]
    items.sort((a, b) => {
      const va = normalize(col.sortValue!(a))
      const vb = normalize(col.sortValue!(b))

      // number compare
      if (typeof va === 'number' && typeof vb === 'number') {
        return dir === 'asc' ? va - vb : vb - va
      }

      const sa = String(va).toLowerCase()
      const sb = String(vb).toLowerCase()
      const cmp = sa.localeCompare(sb, undefined, { numeric: true, sensitivity: 'base' })
      return dir === 'asc' ? cmp : -cmp
    })

    return items
  }, [filteredRows, sortKey, sortDir, colByKey])

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize))

  // Reset/adjust page when data/sort changes
  useEffect(() => {
    setPage(1)
  }, [sortKey, sortDir, pageSize, query])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
    if (page < 1) setPage(1)
  }, [page, totalPages])

  const pageRows = useMemo(() => {
    const p = Math.min(Math.max(1, page), totalPages)
    const start = (p - 1) * pageSize
    return sortedRows.slice(start, start + pageSize)
  }, [sortedRows, page, pageSize, totalPages])

  function toggleSort(key: string) {
    const col = colByKey.get(key)
    if (!col?.sortValue) return

    if (sortKey !== key) {
      setSortKey(key)
      setSortDir('asc')
      return
    }

    setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
  }

  const startIndex = sortedRows.length === 0 ? 0 : (page - 1) * pageSize + 1
  const endIndex = Math.min(sortedRows.length, page * pageSize)

  function goTo(p: number) {
    setPage(Math.min(Math.max(1, p), totalPages))
  }

  return (
    <div className="surface overflow-hidden rounded-xl border border-theme">
      {/* search */}
      <div className="grid grid-cols-1 gap-2 border-b border-theme bg-[var(--surface-2)] px-4 py-3 sm:grid-cols-3 sm:items-center">
        <div className="hidden sm:block" />

        <div className="mx-auto flex w-full max-w-md items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={labels.searchPlaceholder}
            className="w-full rounded-md border border-theme bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
          />
          {query.trim() ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="rounded-md border border-theme bg-[var(--surface)] px-3 py-2 text-xs text-[var(--foreground)] hover:bg-[var(--muted)]"
            >
              {labels.clear}
            </button>
          ) : null}
        </div>

        <div className="hidden sm:block" />
      </div>

      {sortedRows.length === 0 ? (
        <div className="p-6 text-sm text-[var(--muted-foreground)]">
          {query.trim() ? labels.noResults : empty}
        </div>
      ) : (
        <div>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-[var(--surface-2)]">
                <tr className="border-b border-theme">
                  {columns.map((c) => {
                    const sortable = Boolean(c.sortValue)
                    const active = sortKey === c.key
                    const Icon = !sortable
                      ? null
                      : !active
                        ? ArrowUpDown
                        : sortDir === 'asc'
                          ? ArrowUp
                          : ArrowDown

                    return (
                      <th
                        key={c.key}
                        className={
                          'whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] ' +
                          (c.headerClassName ?? '')
                        }
                      >
                        <button
                          type="button"
                          onClick={() => toggleSort(c.key)}
                          disabled={!sortable}
                          className={
                            'inline-flex items-center gap-2 ' +
                            (sortable ? 'hover:text-[var(--foreground)]' : 'cursor-default opacity-80')
                          }
                          aria-sort={
                            !active ? 'none' : sortDir === 'asc' ? 'ascending' : 'descending'
                          }
                        >
                          <span>{c.header}</span>
                          {Icon ? <Icon className="size-3.5 opacity-80" /> : null}
                        </button>
                      </th>
                    )
                  })}
                </tr>
              </thead>

              <tbody className="divide-y">
                {pageRows.map((row, idx) => (
                  <tr
                    key={idx}
                    className={(onRowClick ? 'cursor-pointer ' : '') + 'hover:bg-[var(--muted)]'}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {columns.map((c) => (
                      <td key={c.key} className={'px-4 py-3 align-top ' + (c.className ?? '')}>
                        {c.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* footer/pagination */}
          <div className="flex flex-col gap-2 border-t border-theme bg-[var(--surface-2)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-[var(--muted-foreground)]">
              {fmt(labels.showing, { start: startIndex, end: endIndex, total: sortedRows.length })}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => goTo(page - 1)}
                disabled={page <= 1}
                className="rounded-md border border-theme bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--foreground)] disabled:opacity-50"
              >
                {labels.previous}
              </button>
              <div className="text-xs text-[var(--muted-foreground)]">
                {fmt(labels.page, { page, pages: totalPages })}
              </div>
              <button
                type="button"
                onClick={() => goTo(page + 1)}
                disabled={page >= totalPages}
                className="rounded-md border border-theme bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--foreground)] disabled:opacity-50"
              >
                {labels.next}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
