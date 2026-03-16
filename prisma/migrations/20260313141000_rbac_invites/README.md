Manual migration created by assistant because `prisma migrate dev` could not run non-interactively.

Changes:
- Adds enums UserRole and WorkspaceRole
- Converts User.role from TEXT to enum UserRole (defaults USER; support.guardian.app@gmail.com becomes SUPERADMIN)
- Converts WorkspaceMember.role from TEXT to enum WorkspaceRole (maps owner/admin -> ADMIN)
- Adds UserInviteToken table
