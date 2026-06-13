# Vakansiya bot — hammasini lokalda ishga tushirish
# Ishlatish: PowerShell'da  ->  .\start-all.ps1
$ErrorActionPreference = 'SilentlyContinue'
$root = "D:\Loyixalar\Vakansiya bot"

Write-Host "1/4 Redis (WSL)..." -ForegroundColor Cyan
wsl -u root -e bash -c "redis-server --daemonize yes --bind 0.0.0.0 --protected-mode no 2>/dev/null; redis-cli ping" | Out-Null

Write-Host "2/4 Backend (3001)..." -ForegroundColor Cyan
if (-not (Get-NetTCPConnection -LocalPort 3001 -State Listen)) {
  if (-not (Test-Path "$root\backend\dist\main.js")) {
    Push-Location "$root\backend"; npm run build | Out-Null; Pop-Location
  }
  Start-Process -WindowStyle Minimized -FilePath "node" -ArgumentList "dist\main.js" -WorkingDirectory "$root\backend"
}

Write-Host "3/4 Mini App (5173)..." -ForegroundColor Cyan
if (-not (Get-NetTCPConnection -LocalPort 5173 -State Listen)) {
  Start-Process -WindowStyle Minimized -FilePath "cmd" -ArgumentList "/c npm run dev" -WorkingDirectory "$root\miniapp"
}

Write-Host "4/4 Dashboard (5180)..." -ForegroundColor Cyan
if (-not (Get-NetTCPConnection -LocalPort 5180 -State Listen)) {
  Start-Process -WindowStyle Minimized -FilePath "cmd" -ArgumentList "/c npm run dev" -WorkingDirectory "$root\dashboard"
}

Start-Sleep 8
Write-Host "`n=== Holat ===" -ForegroundColor Green
@(@{n='Backend ';u='http://localhost:3001/api/v1/system/health'},@{n='Mini App';u='http://localhost:5173'},@{n='Dashboard';u='http://localhost:5180'}) | ForEach-Object {
  try { $r=(Invoke-WebRequest $_.u -UseBasicParsing -TimeoutSec 5).StatusCode; Write-Host "$($_.n): $r OK" -ForegroundColor Green } catch { Write-Host "$($_.n): hali tayyor emas" -ForegroundColor Yellow }
}
Write-Host "`nDashboard: http://localhost:5180  (Dev kirish)" -ForegroundColor Cyan
Write-Host "Mini App : http://localhost:5173" -ForegroundColor Cyan
