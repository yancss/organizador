import { z } from 'zod'

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  NEXTAUTH_URL: z.string().min(1).optional(),
  NEXTAUTH_SECRET: z.string().min(1).optional(),
})

export const env = EnvSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
})

export function missingEnvKeys(): string[] {
  const missing: string[] = []
  for (const key of ['DATABASE_URL', 'NEXTAUTH_URL', 'NEXTAUTH_SECRET'] as const) {
    if (!process.env[key] || String(process.env[key]).trim() === '') missing.push(key)
  }
  return missing
}
