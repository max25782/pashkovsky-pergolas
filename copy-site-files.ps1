# Copy public-specific folders to Site
$publicFolders = @(
    "components\home",
    "components\contact",
    "components\footer",
    "components\pergulas",
    "components\fences",
    "components\dgamim",
    "components\video",
    "components\pergola-configurator",
    "components\navbar.tsx",
    "components\contact-section.tsx",
    "components\carousel.tsx",
    "components\articleModal.tsx",
    "components\providers.tsx",
    "components\utm-tracker.tsx",
    "components\ga.tsx",
    "components\google-analytics.tsx",
    "lib\locales.ts",
    "lib\image-url.ts",
    "lib\image-url-array.ts",
    "lib\image-url-client.ts",
    "lib\image-url-array-client.ts",
    "lib\image-props.ts",
    "lib\s3-image-loader.ts",
    "lib\whatsapp-utils.ts",
    "lib\gallery",
    "lib\calculations",
    "data",
    "public",
    "app\icon.svg",
    "app\robots.ts",
    "app\sitemap.ts"
)

foreach ($folder in $publicFolders) {
    if (Test-Path $folder) {
        $dest = Join-Path "apps\site" $folder
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

Write-Host "Site files copied!" -ForegroundColor Green

