$body = '{"email":"test@example.com"}'
try {
  $res = Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/auth/forgot-password' -ContentType 'application/json' -Body $body
  $res | ConvertTo-Json -Compress
} catch {
  'ERR: ' + $_.Exception.Message
  if ($_.Exception.Response) {
    'STATUS: ' + [int]$_.Exception.Response.StatusCode
    $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $sr.ReadToEnd()
  }
}
