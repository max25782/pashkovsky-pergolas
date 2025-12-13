# Diagnostic script to check why deals are empty

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deals Diagnostic Check" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check environment variables
Write-Host "[1] Checking environment variables..." -ForegroundColor Yellow

$envFile = ".env.local"
if (-not (Test-Path $envFile)) {
    $envFile = ".env"
}

if (Test-Path $envFile) {
    Write-Host "  Found: $envFile" -ForegroundColor Green
    
    $envContent = Get-Content $envFile -Raw
    $hasSupabaseUrl = $envContent -match "SUPABASE_URL"
    $hasServiceKey = $envContent -match "SUPABASE_SERVICE_ROLE_KEY"
    $hasAdminToken = $envContent -match "ADMIN_TOKEN"
    
    if ($hasSupabaseUrl) {
        Write-Host "  ✓ SUPABASE_URL is set" -ForegroundColor Green
    } else {
        Write-Host "  ✗ SUPABASE_URL is missing" -ForegroundColor Red
    }
    
    if ($hasServiceKey) {
        Write-Host "  ✓ SUPABASE_SERVICE_ROLE_KEY is set" -ForegroundColor Green
    } else {
        Write-Host "  ✗ SUPABASE_SERVICE_ROLE_KEY is missing" -ForegroundColor Red
    }
    
    if ($hasAdminToken) {
        Write-Host "  ✓ ADMIN_TOKEN is set" -ForegroundColor Green
    } else {
        Write-Host "  ✗ ADMIN_TOKEN is missing" -ForegroundColor Red
    }
} else {
    Write-Host "  ✗ No .env or .env.local file found" -ForegroundColor Red
}

Write-Host ""

# Check if dev server is running
Write-Host "[2] Checking if dev server is running..." -ForegroundColor Yellow
$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Host "  ✓ Node.js processes running" -ForegroundColor Green
    $nodeProcesses | ForEach-Object {
        Write-Host "    PID: $($_.Id)" -ForegroundColor Gray
    }
} else {
    Write-Host "  ⚠ No Node.js processes found" -ForegroundColor Yellow
    Write-Host "    Start dev server: npm run dev" -ForegroundColor Gray
}

Write-Host ""

# Instructions
Write-Host "[3] Common Issues and Solutions:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Issue 1: Missing Supabase credentials" -ForegroundColor Cyan
Write-Host "    Solution: Add to .env.local:" -ForegroundColor Gray
Write-Host "      SUPABASE_URL=your-supabase-url" -ForegroundColor White
Write-Host "      SUPABASE_SERVICE_ROLE_KEY=your-service-role-key" -ForegroundColor White
Write-Host ""
Write-Host "  Issue 2: No deals in database" -ForegroundColor Cyan
Write-Host "    Solution: Create deals via:" -ForegroundColor Gray
Write-Host "      - Admin panel: Click 'Add New Deal'" -ForegroundColor White
Write-Host "      - Convert a lead to a deal" -ForegroundColor White
Write-Host ""
Write-Host "  Issue 3: RLS (Row Level Security) blocking access" -ForegroundColor Cyan
Write-Host "    Solution: Check Supabase dashboard -> Authentication -> Policies" -ForegroundColor Gray
Write-Host "      Make sure SERVICE_ROLE_KEY has access to 'deals' table" -ForegroundColor White
Write-Host ""
Write-Host "  Issue 4: Wrong admin token" -ForegroundColor Cyan
Write-Host "    Solution: Check ADMIN_TOKEN in .env.local matches what you're using" -ForegroundColor Gray
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Check browser console for errors" -ForegroundColor White
Write-Host "2. Check network tab for API responses" -ForegroundColor White
Write-Host "3. Verify Supabase connection in Supabase dashboard" -ForegroundColor White
Write-Host "4. Try creating a test deal manually" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan





