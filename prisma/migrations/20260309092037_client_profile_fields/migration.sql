-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "addressCity" VARCHAR(120),
ADD COLUMN     "addressComplement" VARCHAR(180),
ADD COLUMN     "addressCountry" VARCHAR(2),
ADD COLUMN     "addressDistrict" VARCHAR(120),
ADD COLUMN     "addressNumber" VARCHAR(32),
ADD COLUMN     "addressPostalCode" VARCHAR(16),
ADD COLUMN     "addressState" VARCHAR(80),
ADD COLUMN     "addressStreet" VARCHAR(180),
ADD COLUMN     "birthDate" DATE,
ADD COLUMN     "idCountry" VARCHAR(2),
ADD COLUMN     "idNumber" VARCHAR(64),
ADD COLUMN     "idType" VARCHAR(32),
ADD COLUMN     "phoneCountry" VARCHAR(2);

-- CreateIndex
CREATE INDEX "Client_phone_idx" ON "Client"("phone");
