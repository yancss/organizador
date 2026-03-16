-- Guards for Support SUPERADMIN
-- Enforce that only support.guardian.app@gmail.com can be SUPERADMIN
-- and that this Support user cannot be deleted or have its email/role changed.

-- 1) Ensure there can be only ONE SUPERADMIN row
-- (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS "User_only_one_superadmin"
ON "User" ("role")
WHERE "role" = 'SUPERADMIN';

-- 2) Trigger function to enforce role/email invariants
CREATE OR REPLACE FUNCTION guardian_enforce_support_superadmin()
RETURNS trigger AS $$
DECLARE
  support_email CONSTANT TEXT := 'support.guardian.app@gmail.com';
BEGIN
  -- Normalize email checks (email can be NULL in schema, but SUPERADMIN must not be)
  IF NEW."role" = 'SUPERADMIN' THEN
    IF NEW."email" IS NULL OR lower(NEW."email") <> support_email THEN
      RAISE EXCEPTION 'Only % may have role SUPERADMIN', support_email
        USING ERRCODE = '23514';
    END IF;
  END IF;

  -- The support email must always be SUPERADMIN
  IF NEW."email" IS NOT NULL AND lower(NEW."email") = support_email THEN
    IF NEW."role" <> 'SUPERADMIN' THEN
      RAISE EXCEPTION 'User % must always have role SUPERADMIN', support_email
        USING ERRCODE = '23514';
    END IF;
  END IF;

  -- Prevent changing support email (even case changes)
  IF TG_OP = 'UPDATE' THEN
    IF OLD."email" IS NOT NULL AND lower(OLD."email") = support_email THEN
      IF NEW."email" IS NULL OR lower(NEW."email") <> support_email THEN
        RAISE EXCEPTION 'Cannot change email for %', support_email
          USING ERRCODE = '23514';
      END IF;
    END IF;

    -- Prevent removing SUPERADMIN role from support user
    IF OLD."email" IS NOT NULL AND lower(OLD."email") = support_email THEN
      IF NEW."role" <> 'SUPERADMIN' THEN
        RAISE EXCEPTION 'Cannot change role for %', support_email
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_user_support_superadmin_guard" ON "User";
CREATE TRIGGER "trg_user_support_superadmin_guard"
BEFORE INSERT OR UPDATE ON "User"
FOR EACH ROW
EXECUTE FUNCTION guardian_enforce_support_superadmin();

-- 3) Block deletion of the support user
CREATE OR REPLACE FUNCTION guardian_block_support_user_delete()
RETURNS trigger AS $$
DECLARE
  support_email CONSTANT TEXT := 'support.guardian.app@gmail.com';
BEGIN
  IF OLD."email" IS NOT NULL AND lower(OLD."email") = support_email THEN
    RAISE EXCEPTION 'Cannot delete support user %', support_email
      USING ERRCODE = '23503';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_user_block_support_delete" ON "User";
CREATE TRIGGER "trg_user_block_support_delete"
BEFORE DELETE ON "User"
FOR EACH ROW
EXECUTE FUNCTION guardian_block_support_user_delete();
