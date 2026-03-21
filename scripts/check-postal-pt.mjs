import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

try {
  const c = await prisma.postalPt.count()
  console.log('postalPt count:', c)

  const sample = await prisma.postalPt.findMany({
    where: { cp4: '1000', cp3: '001' },
    select: { cp4: true, cp3: true, distrito: true, concelho: true, localidade: true },
    take: 5,
  })
  console.log('sample 1000-001:', sample)
} finally {
  await prisma.$disconnect()
}
