import { prisma } from '@/lib/prisma'

import { getCustomFieldEntity } from './registry'

type Row = Record<string, unknown>
type Delegate = { findMany: (a: unknown) => Promise<Row[]> }

/** Rótulo curto de um registro de negócio (para pickers e exibição de campos RELATION). */
export function recordTitle(r: Row): string {
  return String(r.code ?? r.name ?? r.title ?? r.reference ?? r.id ?? '')
}

function delegateFor(entity: string): Delegate | null {
  const def = getCustomFieldEntity(entity)
  if (!def) return null
  return (prisma as unknown as Record<string, Delegate>)[def.model] ?? null
}

/** Lista registros de um objeto (id + rótulo) para o seletor de um campo RELATION. */
export async function listEntityRecords(
  entity: string,
  workspaceId: string,
  opts: { q?: string; take?: number } = {},
): Promise<Array<{ id: string; label: string }>> {
  const delegate = delegateFor(entity)
  if (!delegate) return []
  const take = Math.min(Math.max(opts.take ?? 100, 1), 200)

  let rows: Row[]
  try {
    rows = await delegate.findMany({ where: { workspaceId }, take, orderBy: { createdAt: 'desc' } })
  } catch {
    rows = await delegate.findMany({ where: { workspaceId }, take })
  }

  let out = rows.map((r) => ({ id: String(r.id), label: recordTitle(r) || String(r.id) }))
  const q = (opts.q ?? '').trim().toLowerCase()
  if (q) out = out.filter((o) => o.label.toLowerCase().includes(q))
  return out
}

/** Resolve o rótulo de registros específicos (para exibir o valor atual de um campo RELATION). */
export async function resolveEntityLabels(
  entity: string,
  ids: string[],
  workspaceId: string,
): Promise<Map<string, string>> {
  const delegate = delegateFor(entity)
  const uniq = [...new Set(ids.filter(Boolean))]
  if (!delegate || uniq.length === 0) return new Map()
  const rows = await delegate.findMany({ where: { workspaceId, id: { in: uniq } } }).catch(() => [] as Row[])
  return new Map(rows.map((r) => [String(r.id), recordTitle(r) || String(r.id)]))
}
