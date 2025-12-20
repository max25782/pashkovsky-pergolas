# Complete BFG process to remove .env from git history

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "BFG Complete Process" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Download BFG if needed
$bfgPath = "$env:USERPROFILE\Downloads\bfg.jar"
if (-not (Test-Path $bfgPath)) {
    Write-Host "[Step 1] Downloading BFG..." -ForegroundColor Yellow
    $bfgUrl = "https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar"
    try {
        Invoke-WebRequest -Uri $bfgUrl -OutFile $bfgPath -UseBasicParsing
        Write-Host "  Downloaded to: $bfgPath" -ForegroundColor Green
    } catch {
        Write-Host "  Error downloading BFG: $_" -ForegroundColor Red
        Write-Host "  Please download manually from: https://rtyley.github.io/bfg-repo-cleaner/" -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "[Step 1] BFG already downloaded" -ForegroundColor Green
}

# Step 2: Check Java
Write-Host "[Step 2] Checking Java..." -ForegroundColor Yellow
$javaCheck = java -version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: Java not found!" -ForegroundColor Red
    Write-Host "  Please install Java from: https://www.java.com/" -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "  Java found" -ForegroundColor Green
}

# Step 3: Go to mirror repo
Write-Host "[Step 3] Navigating to mirror repository..." -ForegroundColor Yellow
$mirrorPath = "..\pashkovsky-pergolas-clean.git"
if (-not (Test-Path $mirrorPath)) {
    Write-Host "  ERROR: Mirror repo not found at $mirrorPath" -ForegroundColor Red
    Write-Host "  Please clone it first:" -ForegroundColor Yellow
    Write-Host "    cd .." -ForegroundColor Gray
    Write-Host "    git clone --mirror https://github.com/max25782/pashkovsky-pergolas.git pashkovsky-pergolas-clean.git" -ForegroundColor Gray
    exit 1
}

Push-Location $mirrorPath
Write-Host "  In mirror repo: $(Get-Location)" -ForegroundColor Green

# Step 4: Run BFG
Write-Host "[Step 4] Running BFG to remove .env..." -ForegroundColor Yellow
Write-Host "  This may take a minute..." -ForegroundColor Gray
$bfgOutput = java -jar $bfgPath --delete-files .env 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "  BFG completed successfully!" -ForegroundColor Green
    $bfgOutput | Select-Object -Last 10 | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
} else {
    Write-Host "  ERROR: BFG failed" -ForegroundColor Red
    $bfgOutput | ForEach-Object { Write-Host "    $_" -ForegroundColor Red }
    Pop-Location
    exit 1
}

# Step 5: Clean up
Write-Host "[Step 5] Cleaning up..." -ForegroundColor Yellow
git reflog expire --expire=now --all 2>&1 | Out-Null
git gc --prune=now --aggressive 2>&1 | Out-Null
Write-Host "  Cleanup completed" -ForegroundColor Green

# Step 6: Push cleaned history
Write-Host "[Step 6] Pushing cleaned history..." -ForegroundColor Yellow
git push --force 2>&1 | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }

if ($LASTEXITCODE -eq 0) {
    Write-Host "  Pushed successfully!" -ForegroundColor Green
} else {
    Write-Host "  ERROR: Push failed" -ForegroundColor Red
    Pop-Location
    exit 1
}

Pop-Location

# Step 7: Update working repo
Write-Host "[Step 7] Updating working repository..." -ForegroundColor Yellow
cd C:\Users\97252\Downloads\pashkovsky-pergolas_starter
git fetch origin 2>&1 | Out-Null
git reset --hard origin/master 2>&1 | Out-Null
Write-Host "  Working repo updated" -ForegroundColor Green

# Step 8: Verify
Write-Host "[Step 8] Verifying .env is removed..." -ForegroundColor Yellow
$remainingCommits = git log --all --full-history --oneline -- .env 2>&1

if ($remainingCommits -and $remainingCommits.Count -gt 0) {
    Write-Host "  WARNING: Still found commits with .env:" -ForegroundColor Red
    $remainingCommits | ForEach-Object { Write-Host "    $_" -ForegroundColor Red }
} else {
    Write-Host "  SUCCESS: .env removed from all commits!" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Process Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "If verification passed, you can now push:" -ForegroundColor Yellow
Write-Host "  git push --force origin master" -ForegroundColor White
Write-Host ""







