/*
  Import Portugal postal code dataset into PostalPt.

  Expected CSV headers (semicolon or comma separated is OK if you adjust):
    cp4,cp3,distrito,concelho,localidade

  Usage:
    node scripts/import-postal-pt.mjs data/postal_pt.csv

  Notes:
    - This script is intentionally simple.
    - It uses createMany in batches.
*/

import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const file = process.argv[2]
if (!file) {
  console.error('Missing CSV path. Example: node scripts/import-postal-pt.mjs data/postal_pt.csv')
  process.exit(1)
}

const abs = path.resolve(process.cwd(), file)
if (!fs.existsSync(abs)) {
  console.error('File not found:', abs)
  process.exit(1)
}

function splitCsv(line) {
  // Minimal CSV splitter (no quoted commas support). Keep dataset simple.
  if (line.includes(';')) return line.split(';').map((s) => s.trim())
  return line.split(',').map((s) => s.trim())
}

const rl = readline.createInterface({
  input: fs.createReadStream(abs, { encoding: 'utf8' }),
  crlfDelay: Infinity,
})

let header = null
let batch = []
let total = 0

async function flush() {
  if (!batch.length) return
  await prisma.postalPt.createMany({ data: batch, skipDuplicates: true })
  total += batch.length
  batch = []
  process.stdout.write(`\rImported ~${total} rows...`)
}

try {
  // If re-importing, you may want to clear the table first:
  // await prisma.postalPt.deleteMany({})

  for await (const line of rl) {
    const l = line.trim()
    if (!l) continue

    if (!header) {
      header = splitCsv(l).map((h) => h.toLowerCase())
      continue
    }

    const cols = splitCsv(l)
    const row = Object.fromEntries(header.map((h, idx) => [h, cols[idx] ?? '']))

    const cp4 = String(row.cp4 ?? '').replace(/\D/g, '').slice(0, 4)
    const cp3 = String(row.cp3 ?? '').replace(/\D/g, '').slice(0, 3)
    const distrito = String(row.distrito ?? '').trim()
    const concelho = String(row.concelho ?? '').trim()
    const localidade = String(row.localidade ?? '').trim() || null

    if (cp4.length !== 4 || cp3.length !== 3 || !distrito || !concelho) continue

    batch.push({ cp4, cp3, distrito, concelho, localidade })
    if (batch.length >= 1000) await flush()
  }

  await flush()
  console.log(`\nDone. Imported ~${total} rows.`)
} finally {
  await prisma.$disconnect()
}
