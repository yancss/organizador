-- Add INTERMEDIATE to ProductKind enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'ProductKind' AND e.enumlabel = 'INTERMEDIATE'
  ) THEN
    ALTER TYPE "ProductKind" ADD VALUE 'INTERMEDIATE';
  END IF;
END $$;
