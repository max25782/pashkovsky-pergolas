# Stop all processes using ports

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Stopping All Port Processes" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Find all processes listening on ports
Write-Host "[1] Finding processes listening on ports..." -ForegroundColor Yellow
$listeningPorts = Get-NetTCPConnection | Where-Object {$_.State -eq "Listen"} | Select-Object LocalPort, OwningProcess | Sort-Object LocalPort -Unique

if ($listeningPorts) {
    Write-Host "  Found processes on ports:" -ForegroundColor Yellow
    $listeningPorts | ForEach-Object {
        $proc = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Host "    Port $($_.LocalPort) - $($proc.ProcessName) (PID: $($_.OwningProcess))" -ForegroundColor Gray
        }
    }
    Write-Host ""
    
    # Stop processes
    Write-Host "[2] Stopping processes..." -ForegroundColor Yellow
    $pids = $listeningPorts | Select-Object -ExpandProperty OwningProcess -Unique
    $stopped = 0
    $pids | ForEach-Object {
        $proc = Get-Process -Id $_ -ErrorAction SilentlyContinue
        if ($proc) {
            try {
                Stop-Process -Id $_ -Force -ErrorAction Stop
                Write-Host "  Stopped: $($proc.ProcessName) (PID: $_)" -ForegroundColor Green
                $stopped++
            } catch {
                Write-Host "  Failed to stop PID $_: $_" -ForegroundColor Red
            }
        }
    }
    Write-Host "  Stopped $stopped process(es)" -ForegroundColor Green
} else {
    Write-Host "  No processes listening on ports found" -ForegroundColor Green
}

Write-Host ""

# Also stop common development server processes
Write-Host "[3] Stopping Node.js/Next.js processes..." -ForegroundColor Yellow
$nodeProcesses = Get-Process | Where-Object {$_.ProcessName -match "node|next"} -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    $nodeProcesses | ForEach-Object {
        try {
            Stop-Process -Id $_.Id -Force -ErrorAction Stop
            Write-Host "  Stopped: $($_.ProcessName) (PID: $($_.Id))" -ForegroundColor Green
        } catch {
            Write-Host "  Failed to stop $($_.ProcessName): $_" -ForegroundColor Red
        }
    }
} else {
    Write-Host "  No Node.js processes found" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Done!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "All port processes stopped." -ForegroundColor Green
Write-Host ""





