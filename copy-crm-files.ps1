# Copy CRM-specific folders
$crmFolders = @(
    "app\(crm)",
    "app\(auth)",
    "app\admin-api",
    "app\api",
    "components\admin",
    "components\crm",
    "components\offers",
    "components\workers",
    "components\ai-chat",
    "components\ui",
    "components\debug",
    "components\generic",
    "lib\auth",
    "lib\middleware",
    "lib\admin-translations.ts",
    "lib\ai",
    "lib\ai-chat",
    "lib\analytics",
    "lib\api",
    "lib\audit",
    "lib\billing",
    "lib\email.ts",
    "lib\features",
    "lib\leads",
    "lib\offer-calculator.ts",
    "lib\offer-sharing.ts",
    "lib\offers",
    "lib\pdf",
    "lib\permissions",
    "lib\rate-limit.ts",
    "lib\s3-upload.ts",
    "lib\validation",
    "lib\workers",
    "middleware.ts",
    "types",
    "stores",
    "hooks",
    "supabase",
    "tests",
    "app\globals.css"
)

foreach ($folder in $crmFolders) {
    if (Test-Path $folder) {
        $dest = Join-Path "apps\crm" $folder
        $destDir = Split-Path $dest -Parent
        New-Item -ItemType Directory -Force -Path $destDir | Out-Null
        
        if (Test-Path $folder -PathType Container) {
            Write-Host "Copying directory: $folder"
            robocopy $folder $dest /E /NFL /NDL /NJH /NJS /nc /ns /np
        } else {
            Write-Host "Copying file: $folder"
            Copy-Item $folder $dest -Force
        }
    }
}

# Rename (crm) and (auth) folders
if (Test-Path "apps\crm\app\(crm)\app") {
    Move-Item "apps\crm\app\(crm)\app" "apps\crm\app\app" -Force
    Remove-Item "apps\crm\app\(crm)" -Recurse -Force
}

if (Test-Path "apps\crm\app\(auth)") {
    Get-ChildItem "apps\crm\app\(auth)" | Move-Item -Destination "apps\crm\app" -Force
    Remove-Item "apps\crm\app\(auth)" -Recurse -Force
}

Write-Host "CRM files copied!" -ForegroundColor Green

