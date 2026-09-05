-- AlterEnum
ALTER TYPE "CustomFieldType" ADD VALUE 'RELATION';

-- AlterTable
ALTER TABLE "CustomFieldDefinition" ADD COLUMN "relationEntity" VARCHAR(64);
