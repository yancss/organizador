param(
  [int]$Retries = 3
)

$ErrorActionPreference = 'Stop'

Write-Host "[fix-prisma-eperm] NOTE: Not killing node.exe automatically (it can kill the running app/gateway)."
Write-Host "[fix-prisma-eperm] If generate fails with EPERM, stop any running 'next dev/build' that is using Prisma, then retry."

for($i=1; $i -le $Retries; $i++){
  Write-Host "[fix-prisma-eperm] Attempt ${i}/${Retries} - prisma generate"
  try {
    npx prisma generate
    Write-Host "[fix-prisma-eperm] Success."
    exit 0
  } catch {
    Write-Host "[fix-prisma-eperm] Failed: $($_.Exception.Message)"
    Start-Sleep -Seconds 2
  }
}

Write-Host "[fix-prisma-eperm] Still failing. Likely file lock by AV/indexer. Suggested actions:"
Write-Host " - Close all terminals running next dev/build"
Write-Host " - Exclude this repo folder from antivirus real-time scanning"
Write-Host " - Reboot (last resort)"
exit 1
