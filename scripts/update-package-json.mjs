import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const deps = [
  'next-auth',
  '@prisma/client',
  'zod',
  'react-hook-form',
  '@hookform/resolvers',
  '@tanstack/react-query',
  '@tanstack/react-query-devtools',
  '@fullcalendar/core',
  '@fullcalendar/daygrid',
  '@fullcalendar/timegrid',
  '@fullcalendar/interaction',
  '@fullcalendar/react',
  'xlsx',
  'date-fns',
  'lucide-react',
  'clsx',
  'tailwind-merge',
  'class-variance-authority',
];

pkg.dependencies ??= {};
for (const d of deps) {
  const v = JSON.parse(fs.readFileSync(path.join(root, 'node_modules', d, 'package.json'), 'utf8')).version;
  pkg.dependencies[d] = `^${v}`;
}

pkg.devDependencies ??= {};
{
  const v = JSON.parse(fs.readFileSync(path.join(root, 'node_modules', 'prisma', 'package.json'), 'utf8')).version;
  pkg.devDependencies['prisma'] = `^${v}`;
}

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log('updated package.json');
