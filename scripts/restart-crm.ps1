Write-Host "=== Restarting CRM with Clean Cache ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Clean Next.js cache
Write-Host "1. Cleaning Next.js cache..." -ForegroundColor Yellow
Set-Location "C:\Users\97252\Downloads\pashkovsky-pergolas_starter\apps\crm"
if (Test-Path .next) {
    Remove-Item .next -Recurse -Force
    Write-Host "   ✅ Cache cleaned" -ForegroundColor Green
}

# Step 2: Start dev server
Write-Host ""
Write-Host "2. Starting CRM dev server..." -ForegroundColor Yellow
Write-Host "   URL: http://localhost:3001" -ForegroundColor Cyan
Write-Host ""
npm run dev

