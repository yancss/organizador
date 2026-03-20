import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import { defineConfig } from 'prisma/config'

// Prisma CLI loads env through this config file.
// Prefer local-dev env when present, otherwise fallback to .env.
const root = process.cwd()

const explicit = process.env.PRISMA_ENV_FILE
if (explicit) {
  dotenv.config({ path: path.resolve(root, explicit), override: false })
} else {
  const devLocal = path.join(root, '.env.development.local')
  const local = path.join(root, '.env.local')
  const base = path.join(root, '.env')

  if (fs.existsSync(devLocal)) dotenv.config({ path: devLocal, override: false })
  if (fs.existsSync(local)) dotenv.config({ path: local, override: false })
  if (fs.existsSync(base)) dotenv.config({ path: base, override: false })
}

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is required for Prisma')

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: { url },
})
