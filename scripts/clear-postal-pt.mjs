import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

try {
  const r = await prisma.postalPt.deleteMany({})
  console.log('cleared rows:', r.count)
} finally {
  await prisma.$disconnect()
}
