$ErrorActionPreference = 'Stop'

$Root = $PSScriptRoot
$Port = 5173
$OutLog = Join-Path $Root 'vite-dev.out.log'
$ErrLog = Join-Path $Root 'vite-dev.err.log'
$FrontendUrl = "http://127.0.0.1:$Port"

if (-not (Test-Path (Join-Path $Root 'package.json'))) {
    throw "package.json not found in frontend root: $Root"
}

$Existing = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -and $_.OwningProcess -ne 0 })
if ($Existing.Count -gt 0) {
    $Pids = @($Existing | Select-Object -ExpandProperty OwningProcess -Unique)
    Write-Host "Frontend is already running on port $Port. PID(s): $($Pids -join ', ')"
    Write-Host "start.cmd does not stop an existing frontend."
    Write-Host "To stop it, run: .\stop.cmd"
    Write-Host "To cleanly restart it, run: .\restart.cmd"
    exit 0
}

if (Test-Path $OutLog) { Clear-Content -Path $OutLog } else { New-Item -ItemType File -Path $OutLog -Force | Out-Null }
if (Test-Path $ErrLog) { Clear-Content -Path $ErrLog } else { New-Item -ItemType File -Path $ErrLog -Force | Out-Null }

$PnpmCommand = Get-Command 'pnpm.cmd' -ErrorAction SilentlyContinue
if (-not $PnpmCommand) {
    $PnpmCommand = Get-Command 'pnpm' -ErrorAction SilentlyContinue
}
if (-not $PnpmCommand) {
    throw "pnpm was not found. Install pnpm or run this from an environment where pnpm is on PATH."
}

$Process = Start-Process -FilePath $PnpmCommand.Source -ArgumentList @(
    'run',
    'dev',
    '--host',
    '127.0.0.1',
    '--port',
    "$Port",
    '--strictPort'
) -WorkingDirectory $Root -RedirectStandardOutput $OutLog -RedirectStandardError $ErrLog -WindowStyle Hidden -PassThru

Write-Host "Started frontend. PID: $($Process.Id)"
Write-Host "Frontend URL: $FrontendUrl"
Write-Host "Logs:"
Write-Host "  $OutLog"
Write-Host "  $ErrLog"

for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 500
    if ($Process.HasExited) {
        Write-Host "Frontend exited early with code $($Process.ExitCode)."
        Write-Host "Last stderr:"
        Get-Content -Path $ErrLog -Tail 80 -ErrorAction SilentlyContinue
        exit 1
    }

    try {
        $Response = Invoke-WebRequest -Uri $FrontendUrl -UseBasicParsing -TimeoutSec 2
        Write-Host "Frontend check OK: $($Response.StatusCode)"
        exit 0
    } catch {
        # Keep waiting until timeout.
    }
}

Write-Host "Frontend started, but page check did not pass within timeout."
Write-Host "Check logs:"
Write-Host "  $OutLog"
Write-Host "  $ErrLog"
exit 1
