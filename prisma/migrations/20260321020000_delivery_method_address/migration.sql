-- Add delivery method + optional address snapshot for deliveries

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "DeliveryMethod" AS ENUM ('DELIVERY', 'PICKUP');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN IF NOT EXISTS "method" "DeliveryMethod" NOT NULL DEFAULT 'PICKUP';
ALTER TABLE "Delivery" ADD COLUMN IF NOT EXISTS "addressCountry" VARCHAR(2);
ALTER TABLE "Delivery" ADD COLUMN IF NOT EXISTS "addressPostalCode" VARCHAR(16);
ALTER TABLE "Delivery" ADD COLUMN IF NOT EXISTS "addressState" VARCHAR(80);
ALTER TABLE "Delivery" ADD COLUMN IF NOT EXISTS "addressCity" VARCHAR(120);
ALTER TABLE "Delivery" ADD COLUMN IF NOT EXISTS "addressDistrict" VARCHAR(120);
ALTER TABLE "Delivery" ADD COLUMN IF NOT EXISTS "addressStreet" VARCHAR(180);
ALTER TABLE "Delivery" ADD COLUMN IF NOT EXISTS "addressNumber" VARCHAR(40);
ALTER TABLE "Delivery" ADD COLUMN IF NOT EXISTS "addressComplement" VARCHAR(120);
ALTER TABLE "Delivery" ADD COLUMN IF NOT EXISTS "addressNotes" VARCHAR(500);

-- Backfill: existing deliveries are assumed to be actual deliveries (not pickups)
UPDATE "Delivery" SET "method" = 'DELIVERY' WHERE "method" = 'PICKUP';
