param()

$port = 8000
Write-Output "[restart_backend] Checking port $port..."

$pids = @(Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)
if ($pids.Count -gt 0) {
    Write-Output ("[restart_backend] Found PIDs on port {0}: {1}" -f $port, ($pids -join ', '))
    foreach ($foundPid in $pids) {
        try {
            Stop-Process -Id $foundPid -Force -ErrorAction Stop
            Write-Output ("[restart_backend] Stopped PID {0}" -f $foundPid)
        } catch {
            Write-Output ("[restart_backend] Failed to stop PID {0}: {1}" -f $foundPid, $_)
        }
    }
} else {
    Write-Output "[restart_backend] No process found on port $port"
}

# Start the backend in a new PowerShell process so it keeps running after this script exits
$activate = Join-Path $PSScriptRoot ".venv\Scripts\Activate.ps1"
$startCmd = "& `"$activate`"; python backend/main.py"
Write-Output "[restart_backend] Starting backend with command: $startCmd"
Start-Process -FilePath "powershell" -ArgumentList "-NoProfile","-ExecutionPolicy","Bypass","-Command",$startCmd -WorkingDirectory $PSScriptRoot -NoNewWindow -PassThru | Out-Null

Start-Sleep -Seconds 2

# Wait for the server to respond
$up = $false
for ($i = 0; $i -lt 20; $i++) {
    try {
        $resp = Invoke-RestMethod -Uri "http://127.0.0.1:8000/" -UseBasicParsing -TimeoutSec 2
        Write-Output "[restart_backend] Health check success: $($resp | ConvertTo-Json -Depth 2)"
        $up = $true
        break
    } catch {
        Start-Sleep -Seconds 1
    }
}

if (-not $up) {
    Write-Output "[restart_backend] Backend did not respond within timeout."
    exit 1
} else {
    Write-Output "[restart_backend] Backend is running on port $port."
    exit 0
}
