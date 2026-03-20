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
  // Primary create buttons
  [
    'className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90"',
    'className="btn btn-primary"',
  ],
  [
    'className="rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90"',
    'className="btn btn-primary"',
  ],
  // Neutral primary (save)
  [
    'className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"',
    'className="btn btn-primary"',
  ],
  [
    'className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"',
    'className="btn btn-primary"',
  ],
  // Secondary cancel / close
  [
    'className="rounded-lg border border-theme px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)]"',
    'className="btn btn-secondary"',
  ],
  [
    'className="rounded-lg border border-theme bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted)]"',
    'className="btn btn-secondary"',
  ],
  // Danger soft (delete)
  [
    'className="rounded-lg border border-theme px-4 py-2 text-sm text-[var(--danger)] hover:bg-[var(--danger-bg)] disabled:opacity-50"',
    'className="btn btn-danger-soft"',
  ],
  [
    'className="rounded-lg border border-theme px-3 py-2 text-sm text-[var(--danger)] hover:bg-[var(--danger-bg)]"',
    'className="btn btn-danger-soft"',
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

console.log(`codemod-buttons: updated ${changed} files`) 
