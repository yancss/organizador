param(
  [string]$EnvFile = '.env.uat',
  [switch]$WithDemo
)

$ErrorActionPreference = 'Stop'

Write-Host "[provision:uat] Using env file: $EnvFile"

# 1) Migrate
Write-Host "[provision:uat] Running migrations..."
npm run prisma:migrate:uat

# 2) Ensure support user
Write-Host "[provision:uat] Ensuring support user..."
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\run-ensure-support-user-with-envfile.ps1 -EnvFile $EnvFile

# 3) Optional demo seed
if ($WithDemo) {
  Write-Host "[provision:uat] Seeding demo data..."
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\run-seed-demo-with-envfile.ps1 -EnvFile $EnvFile
}

Write-Host "[provision:uat] Done."
