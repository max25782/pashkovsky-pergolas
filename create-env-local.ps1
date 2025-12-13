# Create .env.local from .env with ADMIN_TOKEN

Write-Host "Creating .env.local..." -ForegroundColor Cyan

# Check if .env exists
if (Test-Path .env) {
    Write-Host "Found .env file" -ForegroundColor Green
    
    # Read .env content
    $envContent = Get-Content .env -Raw
    
    # Extract ADMIN_TOKEN if it exists
    if ($envContent -match "ADMIN_TOKEN\s*=\s*(.+)") {
        $adminToken = $matches[1].Trim()
        Write-Host "Found ADMIN_TOKEN in .env" -ForegroundColor Green
        
        # Check if .env.local exists
        if (Test-Path .env.local) {
            Write-Host ".env.local already exists" -ForegroundColor Yellow
            $localContent = Get-Content .env.local -Raw
            
            if ($localContent -match "ADMIN_TOKEN") {
                Write-Host "ADMIN_TOKEN already in .env.local" -ForegroundColor Yellow
                $response = Read-Host "Do you want to update it? (y/n)"
                if ($response -eq 'y') {
                    $localContent = $localContent -replace "ADMIN_TOKEN\s*=.*", "ADMIN_TOKEN=$adminToken"
                    Set-Content .env.local -Value $localContent
                    Write-Host "Updated ADMIN_TOKEN in .env.local" -ForegroundColor Green
                }
            } else {
                Add-Content .env.local -Value "`nADMIN_TOKEN=$adminToken"
                Write-Host "Added ADMIN_TOKEN to .env.local" -ForegroundColor Green
            }
        } else {
            # Copy important env vars to .env.local
            $importantVars = @()
            Get-Content .env | ForEach-Object {
                if ($_ -match "^(SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_ANON_KEY|ADMIN_TOKEN|NEXT_PUBLIC_)") {
                    $importantVars += $_
                }
            }
            
            $importantVars | Set-Content .env.local
            Write-Host "Created .env.local with important variables" -ForegroundColor Green
        }
    } else {
        Write-Host "ADMIN_TOKEN not found in .env" -ForegroundColor Red
        Write-Host "Please add ADMIN_TOKEN to .env.local manually" -ForegroundColor Yellow
        
        # Create .env.local with placeholder
        if (-not (Test-Path .env.local)) {
            @"
# Add your ADMIN_TOKEN here
ADMIN_TOKEN=your-admin-token-here

# Copy other important vars from .env
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
"@ | Set-Content .env.local
            Write-Host "Created .env.local template" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host ".env file not found" -ForegroundColor Red
    
    # Create .env.local template
    if (-not (Test-Path .env.local)) {
        @"
# Admin Token (required for /admin pages)
ADMIN_TOKEN=your-admin-token-here

# Supabase Configuration
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
"@ | Set-Content .env.local
        Write-Host "Created .env.local template" -ForegroundColor Yellow
        Write-Host "Please fill in the values" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Make sure ADMIN_TOKEN in .env.local matches what you enter in the admin page" -ForegroundColor White
Write-Host "2. Restart your dev server: npm run dev" -ForegroundColor White
Write-Host "3. Enter the same token when prompted on /admin/deals page" -ForegroundColor White
Write-Host ""






