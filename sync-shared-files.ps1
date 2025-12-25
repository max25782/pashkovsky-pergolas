# Copy shared files between Site and CRM
Write-Host "Copying shared files..." -ForegroundColor Yellow

# Shared components that both apps need
$sharedComponents = @(
    "providers.tsx"
)

# Shared lib files
$sharedLib = @(
    "locales.ts",
    "image-url.ts",
    "image-url-client.ts",
    "image-url-array.ts",
    "image-url-array-client.ts",
    "image-props.ts",
    "s3-image-loader.ts"
)

# Copy components
foreach ($file in $sharedComponents) {
    if (Test-Path "apps\site\components\$file") {
        Write-Host "  ✓ $file (components)" -ForegroundColor Green
        Copy-Item "apps\site\components\$file" "apps\crm\components\$file" -Force
    }
}

# Copy lib files
foreach ($file in $sharedLib) {
    if (Test-Path "apps\site\lib\$file") {
        Write-Host "  ✓ $file (lib)" -ForegroundColor Green
        Copy-Item "apps\site\lib\$file" "apps\crm\lib\$file" -Force
    }
}

Write-Host "`nDone! Shared files synced." -ForegroundColor Green

