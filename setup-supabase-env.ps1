# Setup Supabase environment variables in .env.local

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Supabase Environment Variables" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env exists and has Supabase vars
$hasEnv = Test-Path .env
$envContent = ""
if ($hasEnv) {
    $envContent = Get-Content .env -Raw
    Write-Host "Found .env file" -ForegroundColor Green
}

# Check what's already in .env.local
$localContent = ""
if (Test-Path .env.local) {
    $localContent = Get-Content .env.local -Raw
    Write-Host "Found .env.local file" -ForegroundColor Green
} else {
    Write-Host ".env.local not found - will create it" -ForegroundColor Yellow
}

# Extract Supabase vars from .env if they exist
$supabaseUrl = ""
$serviceKey = ""
$anonKey = ""

if ($envContent) {
    if ($envContent -match "SUPABASE_URL\s*=\s*(.+)") {
        $supabaseUrl = $matches[1].Trim()
        Write-Host "Found SUPABASE_URL in .env" -ForegroundColor Green
    }
    if ($envContent -match "SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+)") {
        $serviceKey = $matches[1].Trim()
        Write-Host "Found SUPABASE_SERVICE_ROLE_KEY in .env" -ForegroundColor Green
    }
    if ($envContent -match "SUPABASE_ANON_KEY\s*=\s*(.+)") {
        $anonKey = $matches[1].Trim()
        Write-Host "Found SUPABASE_ANON_KEY in .env" -ForegroundColor Green
    }
}

# Check what's in .env.local
$localHasUrl = $localContent -match "SUPABASE_URL"
$localHasServiceKey = $localContent -match "SUPABASE_SERVICE_ROLE_KEY"
$localHasAnonKey = $localContent -match "SUPABASE_ANON_KEY"

# Build .env.local content
$newLines = @()

if ($localContent) {
    # Keep existing content, update/add Supabase vars
    $lines = Get-Content .env.local
    $updated = $false
    
    foreach ($line in $lines) {
        if ($line -match "^(SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_ANON_KEY)\s*=") {
            # Skip old Supabase vars, we'll add new ones
            $updated = $true
            continue
        }
        $newLines += $line
    }
    
    if (-not $updated) {
        # Keep all lines if no Supabase vars found
        $newLines = $lines
    }
} else {
    # Create new file
    if ($envContent -match "ADMIN_TOKEN\s*=\s*(.+)") {
        $adminToken = $matches[1].Trim()
        $newLines += "ADMIN_TOKEN=$adminToken"
        Write-Host "Adding ADMIN_TOKEN from .env" -ForegroundColor Green
    }
}

# Add Supabase vars
if ($supabaseUrl) {
    if (-not $localHasUrl) {
        $newLines += "SUPABASE_URL=$supabaseUrl"
        Write-Host "Adding SUPABASE_URL" -ForegroundColor Green
    } else {
        Write-Host "SUPABASE_URL already in .env.local" -ForegroundColor Yellow
    }
} else {
    Write-Host "SUPABASE_URL not found - you need to add it manually" -ForegroundColor Red
    $newLines += "# SUPABASE_URL=https://your-project.supabase.co"
}

if ($serviceKey) {
    if (-not $localHasServiceKey) {
        $newLines += "SUPABASE_SERVICE_ROLE_KEY=$serviceKey"
        Write-Host "Adding SUPABASE_SERVICE_ROLE_KEY" -ForegroundColor Green
    } else {
        Write-Host "SUPABASE_SERVICE_ROLE_KEY already in .env.local" -ForegroundColor Yellow
    }
} else {
    Write-Host "SUPABASE_SERVICE_ROLE_KEY not found - you need to add it manually" -ForegroundColor Red
    $newLines += "# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key"
}

if ($anonKey) {
    if (-not $localHasAnonKey) {
        $newLines += "SUPABASE_ANON_KEY=$anonKey"
        Write-Host "Adding SUPABASE_ANON_KEY" -ForegroundColor Green
    }
}

# Write .env.local
$newLines | Set-Content .env.local -Encoding utf8
Write-Host ""
Write-Host "Updated .env.local" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. If Supabase vars are missing, add them manually:" -ForegroundColor White
Write-Host "   - Get them from: https://supabase.com/dashboard" -ForegroundColor Gray
Write-Host "   - Project Settings → API → Project URL and Keys" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Restart dev server:" -ForegroundColor White
Write-Host "   npm run dev" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. Required variables:" -ForegroundColor White
Write-Host "   ✓ SUPABASE_URL" -ForegroundColor Green
Write-Host "   ✓ SUPABASE_SERVICE_ROLE_KEY (not anon key!)" -ForegroundColor Green
Write-Host "   ✓ ADMIN_TOKEN" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan






