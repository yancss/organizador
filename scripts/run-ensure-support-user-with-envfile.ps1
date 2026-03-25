param(
  [Parameter(Mandatory=$true)]
  [string]$EnvFile
)

$ErrorActionPreference = 'Stop'

if (!(Test-Path $EnvFile)) {
  throw "Env file not found: $EnvFile"
}

Write-Host "[ensure-support-user] Loading env from $EnvFile"

Get-Content $EnvFile | ForEach-Object {
  $line = $_.Trim()
  if (!$line) { return }
  if ($line.StartsWith('#')) { return }

  $idx = $line.IndexOf('=')
  if ($idx -lt 1) { return }

  $k = $line.Substring(0, $idx).Trim()
  $v = $line.Substring($idx + 1).Trim()

  if (($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'"))) {
    $v = $v.Substring(1, $v.Length - 2)
  }

  [System.Environment]::SetEnvironmentVariable($k, $v)
}

node scripts/ensure-support-user.mjs
