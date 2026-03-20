/*
  Provision a fresh database for a company/project.

  What it does:
    1) Applies Prisma migrations (deploy)
    2) Bootstraps the Support SUPERADMIN + default workspace + password reset link

  Usage:
    npm run provision:db

  Requires:
    DATABASE_URL
    (optional) APP_URL or NEXTAUTH_URL
*/

const { spawnSync } = require('child_process')

function run(cmd, args) {
  const res = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  })
  if (res.status !== 0) {
    process.exit(res.status ?? 1)
  }
}

// Use npx so it works without global prisma.
run('npx', ['prisma', 'migrate', 'deploy'])
run('node', ['scripts/bootstrap-support.js'])
run('node', ['scripts/seed-permissions.mjs'])
