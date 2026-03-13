import fs from 'node:fs'
import path from 'node:path'

const apiRoot = path.join('src', 'app', 'api')

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(p, out)
    else if (ent.isFile() && p.endsWith('route.ts')) out.push(p)
  }
  return out
}

const files = walk(apiRoot)

// Routes that are intentionally public / system-like and therefore do NOT have a session user context.
// Keep this list small and explicit.
const ALLOW_NO_CONTEXT = new Set([
  path.join('src', 'app', 'api', 'auth', 'forgot-password', 'route.ts'),
  path.join('src', 'app', 'api', 'auth', 'reset-password', 'route.ts'),
  path.join('src', 'app', 'api', 'users', 'route.ts'), // signup
  path.join('src', 'app', 'api', 'debug', 'me', 'route.ts'), // dev-only helper
])

const prismaFiles = []
const suspects = []

const rxRequireCall = /requireUser\s*\(\s*\)/
const rxRequireAwaitCall = /await\s+requireUser\s*\(\s*\)/
const rxPrismaAny = /\bprisma\./
const rxPrismaMutation = /\bprisma\.[A-Za-z0-9_]+\.(create|createMany|update|updateMany|delete|deleteMany|upsert)\b/

for (const file of files) {
  const s = fs.readFileSync(file, 'utf8')
  if (!rxPrismaAny.test(s)) continue
  prismaFiles.push(file)

  if (ALLOW_NO_CONTEXT.has(file)) continue

  const hasRequireFn = s.includes('async function requireUser(')
  const callsRequire = rxRequireCall.test(s)
  const awaitsRequire = rxRequireAwaitCall.test(s)
  const requireSetsContext = /enterWithUser\s*\(/.test(s)
  const hasEnterImport = s.includes("from '@/lib/request-context'") && s.includes('enterWithUser')

  // Base rule: prisma usage in a route should generally be behind requireUser.
  if (!hasRequireFn) suspects.push({ file, kind: 'PRISMA_WITHOUT_requireUser_fn' })
  else if (!callsRequire) suspects.push({ file, kind: 'HAS_requireUser_fn_BUT_NO_CALL' })
  else if (!awaitsRequire) suspects.push({ file, kind: 'requireUser_called_without_await (heuristic)' })

  if (hasRequireFn && (!hasEnterImport || !requireSetsContext)) {
    suspects.push({ file, kind: 'requireUser_without_enterWithUser' })
  }
}

// Stronger rule: any route that mutates prisma should definitely be behind requireUser + context.
const mutationIssues = []
for (const file of files) {
  const s = fs.readFileSync(file, 'utf8')
  if (!rxPrismaMutation.test(s)) continue

  if (ALLOW_NO_CONTEXT.has(file)) continue

  const hasRequireFn = s.includes('async function requireUser(')
  const awaitsRequire = rxRequireAwaitCall.test(s)
  const requireSetsContext = /enterWithUser\s*\(/.test(s)

  if (!hasRequireFn || !awaitsRequire || !requireSetsContext) {
    mutationIssues.push({ file, hasRequireFn, awaitsRequire, requireSetsContext })
  }
}

console.log(`TOTAL route.ts scanned: ${files.length}`)
console.log(`TOTAL route.ts with prisma usage: ${prismaFiles.length}`)
console.log(`TOTAL route.ts with prisma mutations (create/update/delete/upsert): ${files.filter(f=>rxPrismaMutation.test(fs.readFileSync(f,'utf8'))).length}`)

if (mutationIssues.length) {
  console.log('\nMUTATION ROUTES MISSING CONTEXT (should fix):')
  for (const x of mutationIssues) {
    console.log(`- ${x.file} | requireFn=${x.hasRequireFn} awaitRequire=${x.awaitsRequire} enter=${x.requireSetsContext}`)
  }
} else {
  console.log('\nOK: no mutation route is missing requireUser()+enterWithUser()')
}

if (suspects.length) {
  console.log('\nOTHER PRISMA ROUTES THAT DO NOT FOLLOW THE PATTERN (review expected exceptions):')
  for (const x of suspects) console.log(`- ${x.kind}: ${x.file}`)
} else {
  console.log('\nOK: all prisma routes follow requireUser pattern')
}
