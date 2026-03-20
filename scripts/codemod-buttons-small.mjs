import fs from 'node:fs'
import path from 'node:path'

const root = path.join(process.cwd(), 'src')

function walk(dir) {
  const out = []
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) out.push(...walk(p))
    else if (p.endsWith('.tsx') || p.endsWith('.ts')) out.push(p)
  }
  return out
}

const files = walk(root)

const replacements = [
  // Small table action buttons
  [
    'className="rounded-md border border-theme bg-[var(--surface)] px-3 py-1.5 text-xs hover:bg-[var(--muted)]"',
    'className="btn btn-secondary btn-sm"',
  ],
  [
    'className="rounded-md border border-theme bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--foreground)] hover:bg-[var(--muted)]"',
    'className="btn btn-secondary btn-sm"',
  ],
  [
    'className="rounded-md border border-theme bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--foreground)] disabled:opacity-50"',
    'className="btn btn-secondary btn-sm"',
  ],
  [
    'className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700 hover:bg-red-100"',
    'className="btn btn-danger-soft btn-sm"',
  ],
  // Success soft (mark paid)
  [
    'className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800 hover:bg-emerald-100"',
    'className="btn btn-success-soft btn-sm"',
  ],
  // OrderBoard / purchases add-item small buttons
  [
    'className="rounded-md border border-theme px-3 py-1.5 text-sm hover:bg-[var(--muted)]"',
    'className="btn btn-secondary btn-sm"',
  ],
  // Icon buttons in toolbars
  [
    'className="grid size-8 place-items-center rounded-md border border-theme bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--muted)]"',
    'className="btn btn-secondary btn-icon"',
  ],
  [
    'className="grid size-9 place-items-center rounded-md border border-theme bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--muted)]"',
    'className="btn btn-secondary btn-icon"',
  ],
  [
    'className="grid size-9 place-items-center rounded-md text-lg text-[var(--foreground)] hover:bg-[var(--muted)]"',
    'className="btn btn-secondary btn-icon"',
  ],
  [
    'className="grid size-9 place-items-center rounded-md text-lg text-[var(--foreground)] hover:bg-[var(--muted)]"',
    'className="btn btn-secondary btn-icon"',
  ],
]

let changed = 0
for (const f of files) {
  let s = fs.readFileSync(f, 'utf8')
  const before = s
  for (const [oldText, newText] of replacements) {
    s = s.split(oldText).join(newText)
  }
  if (s !== before) {
    fs.writeFileSync(f, s)
    changed++
  }
}

console.log(`codemod-buttons-small: updated ${changed} files`)
