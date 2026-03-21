/*
  Build a minimal CSV (cp4,cp3,distrito,concelho,localidade) from DSSG-PT dataset.

  Input:
    data/postal_pt_dssg.csv (from mp-mapeamento-cp7)
    Columns include: CodigoPostal,Distrito,Concelho,...

  Output:
    data/postal_pt.csv

  Usage:
    node scripts/build-postal-pt-from-dssg.mjs
*/

import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'

const inFile = path.resolve(process.cwd(), 'data/postal_pt_dssg.csv')
const outFile = path.resolve(process.cwd(), 'data/postal_pt.csv')

if (!fs.existsSync(inFile)) {
  console.error('Missing input file:', inFile)
  process.exit(1)
}

const rl = readline.createInterface({
  input: fs.createReadStream(inFile, { encoding: 'utf8' }),
  crlfDelay: Infinity,
})

let header = null
let idxCodigoPostal = -1
let idxDistrito = -1
let idxConcelho = -1
let idxFreguesia = -1

function splitCsv(line) {
  // Basic CSV splitter for this dataset (handles quoted fields with commas poorly).
  // DSSG file is standard CSV with commas and quotes; we use a small parser.
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      // handle escaped quotes
      const next = line[i + 1]
      if (inQuotes && next === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur)
  return out
}

const seen = new Set()
let rows = 0

const out = fs.createWriteStream(outFile, { encoding: 'utf8' })
out.write('cp4,cp3,distrito,concelho,localidade\n')

for await (const line of rl) {
  const l = line.trimEnd()
  if (!l) continue

  if (!header) {
    header = splitCsv(l).map((h) => h.trim())
    idxCodigoPostal = header.indexOf('CodigoPostal')
    idxDistrito = header.indexOf('Distrito')
    idxConcelho = header.indexOf('Concelho')
    idxFreguesia = header.indexOf('Freguesia')

    if (idxCodigoPostal < 0 || idxDistrito < 0 || idxConcelho < 0) {
      console.error('Unexpected header. Missing required columns.')
      console.error(header)
      process.exit(1)
    }
    continue
  }

  const cols = splitCsv(l)
  const cp7 = String(cols[idxCodigoPostal] ?? '').replace(/\D/g, '').slice(0, 7)
  const distrito = String(cols[idxDistrito] ?? '').trim()
  const concelho = String(cols[idxConcelho] ?? '').trim()
  const localidade = idxFreguesia >= 0 ? String(cols[idxFreguesia] ?? '').trim() : ''

  if (cp7.length !== 7 || !distrito || !concelho) continue

  const cp4 = cp7.slice(0, 4)
  const cp3 = cp7.slice(4)

  const key = `${cp4}-${cp3}__${distrito}__${concelho}`
  if (seen.has(key)) continue
  seen.add(key)

  const esc = (v) => {
    const s = String(v ?? '')
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"'
    return s
  }

  out.write(`${cp4},${cp3},${esc(distrito)},${esc(concelho)},${esc(localidade)}\n`)
  rows++
  if (rows % 50000 === 0) process.stdout.write(`\rWrote ${rows} rows...`)
}

out.end()
console.log(`\nDone. Wrote ${rows} rows to ${path.relative(process.cwd(), outFile)}`)
