# Clean and Restart Script for Next.js Monorepo
# Run this script to clean all caches and restart dev servers

Write-Host "🧹 Cleaning Next.js caches..." -ForegroundColor Cyan

# Clean Site cache
if (Test-Path "apps\site\.next") {
    Remove-Item -Path "apps\site\.next" -Recurse -Force
    Write-Host "✅ Site cache cleared" -ForegroundColor Green
}

# Clean CRM cache
if (Test-Path "apps\crm\.next") {
    Remove-Item -Path "apps\crm\.next" -Recurse -Force
    Write-Host "✅ CRM cache cleared" -ForegroundColor Green
}

# Clean root cache
if (Test-Path ".next") {
    Remove-Item -Path ".next" -Recurse -Force
    Write-Host "✅ Root cache cleared" -ForegroundColor Green
}

# Clean node_modules/.cache
if (Test-Path "node_modules\.cache") {
    Remove-Item -Path "node_modules\.cache" -Recurse -Force
    Write-Host "✅ Node modules cache cleared" -ForegroundColor Green
}

Write-Host ""
Write-Host "✨ All caches cleared!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Yellow
Write-Host "1. Stop all running dev servers (Ctrl+C)" -ForegroundColor White
Write-Host "2. Clear browser cache (Ctrl+Shift+Delete)" -ForegroundColor White
Write-Host "3. Restart dev server: npm run dev" -ForegroundColor White
Write-Host ""

