const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');

function loadEnvFile(p) {
  if (!fs.existsSync(p)) return;
  const s = fs.readFileSync(p, 'utf8');
  for (const line of s.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const m = t.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = val;
  }
}

// Prefer local dev env
loadEnvFile(path.join(__dirname, '.env.development.local'));
loadEnvFile(path.join(__dirname, '.env'));

async function main() {
  console.log('DATABASE_URL=', process.env.DATABASE_URL);
  const p = new PrismaClient();
  try {
    const rows = await p.auditEvent.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, workspaceId: true, entityType: true, entityId: true, summary: true, changes: true },
    });
    console.log(JSON.stringify(rows, null, 2));
  } finally {
    await p.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
