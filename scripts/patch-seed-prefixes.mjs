import { readFileSync, writeFileSync } from 'node:fs'

const path = new URL('./seed-dev.mjs', import.meta.url)
let s = readFileSync(path, 'utf8')

const repl = {
  "makeId('US')": "makeId('USR')",
  "makeId('WS')": "makeId('WKS')",
  "makeId('WM')": "makeId('WMB')",
  "makeId('FA')": "makeId('FAC')",
  "makeId('FC')": "makeId('FCA')",
  "makeId('CL')": "makeId('CLT')",
  "makeId('PR')": "makeId('PRD')",
  "makeId('IV')": "makeId('INV')",
  "makeId('RC')": "makeId('RCP')",
  "makeId('RI')": "makeId('RCI')",
  "makeId('PO')": "makeId('POR')",
  "makeId('PI')": "makeId('POI')",
  "makeId('FE')": "makeId('FEN')",
  "makeId('CO')": "makeId('CNS')",
  "makeId('SO')": "makeId('SOR')",
  "makeId('SI')": "makeId('SOI')",
  "makeId('DE')": "makeId('DLV')",
  "makeId('DI')": "makeId('DLI')",
  "makeId('RE')": "makeId('RCV')",
  "makeId('PA')": "makeId('PAY')",
  "makeId('PU')": "makeId('PUR')",
}

for (const [a, b] of Object.entries(repl)) {
  s = s.split(a).join(b)
}

writeFileSync(path, s, 'utf8')
console.log('patched seed-dev.mjs prefixes')
