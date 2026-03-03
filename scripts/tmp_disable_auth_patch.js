const fs = require('fs');
const path = require('path');

const ROOT = path.resolve('D:/ProjetosT/organizador');

function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function patchRequireUser(file, src) {
  if (!src.includes('async function requireUser()')) return null;
  if (src.includes('DISABLE_AUTH')) return null; // already patched

  // insert bypass right after userId extraction line if possible
  const re = /(async function requireUser\(\) \{\s*\n\s*const session = await getServerSession\(authOptions\)\s*\n\s*const userId = \(session\?\.user as \{ id\?: string \} \| undefined\)\?\.id\s*\n)/m;
  const m = src.match(re);
  if (!m) return null;

  const insert = `${m[1]}  // TEMP: bypass auth for local testing\n  if (process.env.DISABLE_AUTH === '1') {\n    // pick first user in DB (or create a default)\n    let u = await prisma.user.findFirst({ select: { id: true } })\n    if (!u) {\n      u = await prisma.user.create({\n        data: {\n          email: 'dev@guardian.local',\n          name: 'Dev',\n          active: true,\n          role: 'owner',\n        },\n        select: { id: true },\n      })\n    }\n    return { ok: true, userId: u.id }\n  }\n\n`;

  return src.replace(re, insert);
}

function patchAppPage(file, src) {
  // Remove session gate in /app page.
  if (!file.endsWith(path.join('src', 'app', 'app', 'page.tsx'))) return null;
  if (src.includes('DISABLE_AUTH')) return null;

  // Replace the block that checks session and returns login link with bypassed behavior.
  const re = /const session = await getServerSession\(authOptions\)[\s\S]*?return <OrderBoard view="upcoming" \/>\s*\n}\s*$/m;
  if (!re.test(src)) return null;

  const replacement = `const session = await getServerSession(authOptions)\n\n  // TEMP: bypass auth for local testing\n  if (process.env.DISABLE_AUTH === '1') {\n    return <OrderBoard view="upcoming" />\n  }\n\n  if (!session) {\n    return (\n      <div className="rounded-md border p-6">\n        <h1 className="text-xl font-semibold">Entrar</h1>\n        <p className="mt-2 text-sm text-neutral-600">Faça login para acessar o app.</p>\n        <Link\n          href="/login"\n          className="mt-4 inline-flex rounded-md bg-black px-4 py-2 text-white hover:opacity-90"\n        >\n          Ir para login\n        </Link>\n      </div>\n    )\n  }\n\n  return <OrderBoard view="upcoming" />\n}\n`;

  return src.replace(re, replacement);
}

function patchSettingsPage(file, src) {
  if (!file.endsWith(path.join('src', 'app', 'app', 'settings', 'page.tsx'))) return null;
  if (src.includes('DISABLE_AUTH')) return null;

  // after session fetch, add bypass.
  const re = /(const session = await getServerSession\(authOptions\)\s*\n)/m;
  const m = src.match(re);
  if (!m) return null;

  const insert = `${m[1]}\n  // TEMP: bypass auth for local testing\n  if (process.env.DISABLE_AUTH === '1') {\n    return <SettingsPanel />\n  }\n\n`;
  return src.replace(re, insert);
}

function main() {
  const files = walk(path.join(ROOT, 'src'))
    .filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));

  let changed = 0;
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');

    let out = patchRequireUser(file, src);
    if (!out) out = patchAppPage(file, src);
    if (!out) out = patchSettingsPage(file, src);

    if (out && out !== src) {
      fs.writeFileSync(file, out, 'utf8');
      changed++;
      console.log('patched', path.relative(ROOT, file));
    }
  }

  console.log('done. files changed:', changed);
}

main();
