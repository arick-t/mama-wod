# Serve the app on all interfaces so you can open it from your phone (same WiFi).
# Usage: .\serve-mobile.ps1   or   pwsh .\serve-mobile.ps1

$port = 8080
$addrs = @()
try {
  Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object {
    $_.IPAddress -notlike "127.*" -and $_.PrefixOrigin -in @("Dhcp","Manual")
  } | ForEach-Object { $addrs += $_.IPAddress }
} catch {}
if (-not $addrs.Count) {
  $addrs = @("192.168.1.???")
}
Write-Host ""
Write-Host "  Open on your phone (same WiFi):" -ForegroundColor Cyan
foreach ($a in $addrs) { Write-Host "    http://${a}:$port" -ForegroundColor Yellow }
Write-Host "  Press Ctrl+C to stop." -ForegroundColor Gray
Write-Host ""
python -m http.server $port --bind 0.0.0.0
