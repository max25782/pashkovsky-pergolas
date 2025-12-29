Write-Host "`n================================" -ForegroundColor Cyan
Write-Host "Installing Redis Client" -ForegroundColor Yellow
Write-Host "================================`n" -ForegroundColor Cyan

Set-Location apps/crm

Write-Host "Installing @upstash/redis..." -ForegroundColor White
npm install @upstash/redis

Write-Host "`n✅ Installation complete!`n" -ForegroundColor Green

Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Create free Redis database: " -ForegroundColor White -NoNewline
Write-Host "https://console.upstash.com/" -ForegroundColor Blue
Write-Host "2. Add credentials to .env.local:" -ForegroundColor White
Write-Host "   UPSTASH_REDIS_REST_URL=https://..." -ForegroundColor Gray
Write-Host "   UPSTASH_REDIS_REST_TOKEN=..." -ForegroundColor Gray
Write-Host "3. Restart CRM server`n" -ForegroundColor White

Write-Host "See: REDIS_SETUP.md for detailed instructions" -ForegroundColor Yellow
Write-Host "================================`n" -ForegroundColor Cyan

