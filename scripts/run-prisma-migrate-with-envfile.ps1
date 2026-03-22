param(
  [Parameter(Mandatory=$true)][string]$EnvFile
)

if (-not (Test-Path $EnvFile)) {
  throw "Env file not found: $EnvFile"
}

Get-Content $EnvFile | ForEach-Object { $_.Trim() } | Where-Object { $_ -and -not $_.StartsWith('#') } | ForEach-Object {
  $line = $_
  $i = $line.IndexOf('=')
  if ($i -lt 1) { return }

  $k = $line.Substring(0, $i).Trim()
  $v = $line.Substring($i + 1).Trim()

  if ((($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'"))) -and $v.Length -ge 2) {
    $v = $v.Substring(1, $v.Length - 2)
  }

  Set-Item -Path "Env:$k" -Value $v
}

npx prisma migrate deploy
