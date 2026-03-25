import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const email = (process.env.TARGET_EMAIL || 'support.guardian.app@gmail.com').trim().toLowerCase()
  const password = process.env.TARGET_PASSWORD || '123456'

  if (!password || password.length < 6) throw new Error('TARGET_PASSWORD must be at least 6 chars')

  const hash = await bcrypt.hash(password, 10)

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: 'Support Guardian',
      role: 'SUPERADMIN',
      active: true,
      passwordHash: hash,
    },
    update: {
      active: true,
      passwordHash: hash,
    },
    select: { id: true, email: true },
  })

  console.log(`[set-user-password] ok email=${user.email} id=${user.id}`)
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error('[set-user-password] failed', e)
    await prisma.$disconnect()
    process.exit(1)
  })
