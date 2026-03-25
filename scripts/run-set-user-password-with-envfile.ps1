param(
  [Parameter(Mandatory=$true)]
  [string]$EnvFile,
  [string]$Email = 'support.guardian.app@gmail.com',
  [string]$Password = '123456'
)

$ErrorActionPreference = 'Stop'

if (!(Test-Path $EnvFile)) {
  throw "Env file not found: $EnvFile"
}

Write-Host "[set-user-password] Loading env from $EnvFile"

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

$env:TARGET_EMAIL = $Email
$env:TARGET_PASSWORD = $Password

node scripts/set-user-password.mjs
