# Clean up old files after monorepo migration

Write-Host "Cleaning up old project structure..." -ForegroundColor Yellow

# Create archive folder for backup
$archiveDir = "old-structure-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
New-Item -ItemType Directory -Path $archiveDir -Force | Out-Null

# Move old folders to archive
$foldersToArchive = @(
    "app",
    "components",
    "lib",
    "types",
    "hooks",
    "stores"
)

foreach ($folder in $foldersToArchive) {
    if (Test-Path $folder) {
        Write-Host "Archiving: $folder" -ForegroundColor Cyan
        Move-Item $folder (Join-Path $archiveDir $folder) -Force
    }
}

# Keep these in root:
# - scripts/ (общие утилиты)
# - supabase/ (будет только в CRM, но для справки оставим)
# - docs/ (документация)
# - public/ (уже скопирован в apps)
# - data/ (уже скопирован в apps)

Write-Host "`nOld structure archived to: $archiveDir" -ForegroundColor Green
Write-Host "`nYou can safely delete this folder after verifying apps work." -ForegroundColor Yellow
Write-Host "`nTo delete: Remove-Item '$archiveDir' -Recurse -Force" -ForegroundColor Gray

