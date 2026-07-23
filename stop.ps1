$ErrorActionPreference = 'Stop'

$Port = 5173
$Connections = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -and $_.OwningProcess -ne 0 })

if ($Connections.Count -eq 0) {
    Write-Host "Frontend is not running on port $Port."
    exit 0
}

$Pids = @($Connections | Select-Object -ExpandProperty OwningProcess -Unique)

foreach ($ProcessId in $Pids) {
    if ($ProcessId -and $ProcessId -ne 0) {
        try {
            $Process = Get-Process -Id $ProcessId -ErrorAction Stop
            Stop-Process -Id $ProcessId -Force -ErrorAction Stop
            Write-Host "Stopped frontend process. PID: $ProcessId ($($Process.ProcessName))"
        } catch {
            Write-Host "Could not stop PID $ProcessId. $($_.Exception.Message)"
        }
    }
}

for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 250
    $Remaining = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -and $_.OwningProcess -ne 0 })
    if ($Remaining.Count -eq 0) {
        Write-Host "Frontend port $Port is now free."
        exit 0
    }
}

$RemainingPids = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -and $_.OwningProcess -ne 0 } | Select-Object -ExpandProperty OwningProcess -Unique)
Write-Host "Frontend port $Port is still occupied. PID(s): $($RemainingPids -join ', ')"
exit 1
