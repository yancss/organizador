import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const repoRoot = process.cwd()

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) out.push(...walk(p))
    else out.push(p)
  }
  return out
}

function toPosix(p) {
  return p.split(sep).join('/')
}

function extractRoutesFromAppPages(appDir) {
  const files = walk(appDir).filter((p) => p.endsWith('page.tsx') || p.endsWith('page.jsx') || p.endsWith('page.ts') || p.endsWith('page.js'))
  const routes = []
  for (const f of files) {
    const rel = toPosix(relative(appDir, f))
    // rel like: sales/orders/[id]/page.tsx
    const parts = rel.split('/')
    parts.pop() // remove page.*
    const route = '/' + parts.join('/')
    routes.push(route === '/' ? '/app' : '/app/' + parts.join('/'))
  }
  // Fix double /app/app when appDir already is src/app/app
  return [...new Set(routes.map((r) => r.replace(/^\/app\/app/, '/app')))].sort()
}

function extractApiRoutes(apiDir) {
  const files = walk(apiDir).filter((p) => p.endsWith('route.ts') || p.endsWith('route.js'))
  const routes = []
  for (const f of files) {
    const rel = toPosix(relative(apiDir, f))
    // rel like: orders/search/route.ts
    const parts = rel.split('/')
    parts.pop() // route.*
    routes.push('/api/' + parts.join('/'))
  }
  return [...new Set(routes)].sort()
}

function parsePrismaSchema(schemaPath) {
  const s = readFileSync(schemaPath, 'utf8')
  const models = [...s.matchAll(/^model\s+(\w+)\s+\{/gm)].map((m) => m[1]).sort()
  const enums = [...s.matchAll(/^enum\s+(\w+)\s+\{/gm)].map((m) => m[1]).sort()
  const relations = []
  // quick scan for @relation name strings
  for (const m of s.matchAll(/@relation\("([^"]+)"/g)) relations.push(m[1])
  return { models, enums, relationNames: [...new Set(relations)].sort() }
}

function readDocsText(docsDir) {
  const mdFiles = walk(docsDir).filter((p) => p.toLowerCase().endsWith('.md'))
  const texts = []
  for (const f of mdFiles) {
    texts.push({ file: toPosix(relative(repoRoot, f)), text: readFileSync(f, 'utf8') })
  }
  // include README
  try {
    const readmePath = join(repoRoot, 'README.md')
    texts.push({ file: 'README.md', text: readFileSync(readmePath, 'utf8') })
  } catch {}
  return { mdFiles, texts }
}

function findMentions(texts, needle) {
  const hits = []
  for (const { file, text } of texts) {
    const idx = text.indexOf(needle)
    if (idx !== -1) hits.push(file)
  }
  return hits
}

function main() {
  const schemaPath = join(repoRoot, 'prisma', 'schema.prisma')
  const appPagesDir = join(repoRoot, 'src', 'app', 'app')
  const apiDir = join(repoRoot, 'src', 'app', 'api')
  const docsDir = join(repoRoot, 'docs')

  const { models, enums } = parsePrismaSchema(schemaPath)
  const appRoutes = extractRoutesFromAppPages(appPagesDir)
  const apiRoutes = extractApiRoutes(apiDir)
  const { texts } = readDocsText(docsDir)

  // Compare documented routes in PROJECT.md (rough): we just check if each actual route is mentioned somewhere in docs/PROJECT.md
  const project = texts.find((t) => t.file === 'docs/PROJECT.md')
  const projectText = project?.text ?? ''

  const appMissingInProject = appRoutes.filter((r) => !projectText.includes('`' + r + '`') && !projectText.includes(r))
  const apiMissingInProject = apiRoutes.filter((r) => !projectText.includes('`' + r + '`') && !projectText.includes(r))

  // Look for stale/legacy mentions
  const legacyNeedles = [
    'Event',
    'OrderItem',
    'Order (mapeado para tabela `Event`)',
    'antes de PV/Entrega/Recebíveis',
    '/api/events',
    '/app/purchases',
    'Order' // broad; we will post-process for noisy ones
  ]

  const legacyHits = legacyNeedles
    .map((n) => ({ needle: n, files: findMentions(texts, n) }))
    .filter((h) => h.files.length)

  // Check ID prefixes doc completeness: ensure every model is present in ID-PREFIXES.md
  const idDoc = texts.find((t) => t.file === 'docs/ID-PREFIXES.md')?.text ?? ''
  const modelsMissingInIdDoc = models.filter((m) => !idDoc.includes(m))

  const now = new Date()
  const stamp = now.toISOString().slice(0, 10)
  const outPath = join(repoRoot, 'docs', `DOCS-AUDIT-${stamp}.md`)

  const lines = []
  lines.push(`# Pente-fino de documentação — ${stamp}`)
  lines.push('')
  lines.push('Este relatório foi gerado automaticamente comparando:')
  lines.push('- `prisma/schema.prisma` (models/enums)')
  lines.push('- `src/app/app/**/page.*` (rotas de UI)')
  lines.push('- `src/app/api/**/route.*` (rotas de API)')
  lines.push('- `docs/*.md` + `README.md` (conteúdo documentado)')
  lines.push('')

  lines.push('## 1) Rotas de UI existentes (src/app/app)')
  lines.push(`Total: ${appRoutes.length}`)
  lines.push('')
  lines.push(appRoutes.map((r) => '- `' + r + '`').join('\n'))
  lines.push('')

  lines.push('## 2) Rotas de API existentes (src/app/api)')
  lines.push(`Total: ${apiRoutes.length}`)
  lines.push('')
  lines.push(apiRoutes.map((r) => '- `' + r + '`').join('\n'))
  lines.push('')

  lines.push('## 3) Possíveis faltas no docs/PROJECT.md')
  lines.push('> Heurística: busca simples por menção textual da rota. Pode dar falso-positivo/falso-negativo.')
  lines.push('')
  lines.push(`### 3.1) UI routes não mencionadas (${appMissingInProject.length})`)
  lines.push(appMissingInProject.length ? appMissingInProject.map((r) => `- ${r}`).join('\n') : '- (nenhuma)')
  lines.push('')
  lines.push(`### 3.2) API routes não mencionadas (${apiMissingInProject.length})`)
  lines.push(apiMissingInProject.length ? apiMissingInProject.map((r) => `- ${r}`).join('\n') : '- (nenhuma)')
  lines.push('')

  lines.push('## 4) Models/enums no Prisma')
  lines.push(`Models (${models.length}): ${models.join(', ')}`)
  lines.push('')
  lines.push(`Enums (${enums.length}): ${enums.join(', ')}`)
  lines.push('')

  lines.push('## 5) Checagem do docs/ID-PREFIXES.md')
  lines.push(`Models não encontrados no arquivo (por nome): ${modelsMissingInIdDoc.length}`)
  lines.push(modelsMissingInIdDoc.length ? modelsMissingInIdDoc.map((m) => `- ${m}`).join('\n') : '- (ok)')
  lines.push('')

  lines.push('## 6) Menções potencialmente desatualizadas / legado (busca literal)')
  for (const h of legacyHits) {
    // Avoid super noisy "Order" entry
    if (h.needle === 'Order' && h.files.length > 10) continue
    lines.push(`### "${h.needle}" (${h.files.length})`)
    lines.push(h.files.map((f) => `- ${f}`).join('\n'))
    lines.push('')
  }

  writeFileSync(outPath, lines.join('\n'), 'utf8')
  console.log('Wrote', toPosix(relative(repoRoot, outPath)))
  console.log('Summary:', {
    appRoutes: appRoutes.length,
    apiRoutes: apiRoutes.length,
    appMissingInProject: appMissingInProject.length,
    apiMissingInProject: apiMissingInProject.length,
    models: models.length,
    enums: enums.length,
    modelsMissingInIdDoc: modelsMissingInIdDoc.length,
  })
}

main()
