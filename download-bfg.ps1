# Download BFG Repo-Cleaner
Write-Host "Downloading BFG Repo-Cleaner..." -ForegroundColor Cyan

$bfgUrl = "https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar"
$downloadPath = "$env:USERPROFILE\Downloads\bfg.jar"

try {
    Write-Host "Downloading from: $bfgUrl" -ForegroundColor Yellow
    Invoke-WebRequest -Uri $bfgUrl -OutFile $downloadPath -UseBasicParsing
    Write-Host "Downloaded to: $downloadPath" -ForegroundColor Green
    Write-Host ""
    Write-Host "Now run:" -ForegroundColor Cyan
    Write-Host "  java -jar `"$downloadPath`" --delete-files .env" -ForegroundColor White
    Write-Host ""
    Write-Host "In the mirror repository directory:" -ForegroundColor Yellow
    Write-Host "  cd ..\pashkovsky-pergolas-clean.git" -ForegroundColor Gray
} catch {
    Write-Host "Error downloading: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Alternative: Download manually from:" -ForegroundColor Yellow
    Write-Host "  https://rtyley.github.io/bfg-repo-cleaner/" -ForegroundColor Cyan
}








