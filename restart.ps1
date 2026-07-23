$ErrorActionPreference = 'Stop'

$ScriptDir = $PSScriptRoot

& (Join-Path $ScriptDir 'stop.ps1')
if (-not $?) {
    throw "Frontend stop script failed; startup was not attempted."
}
Start-Sleep -Seconds 1
& (Join-Path $ScriptDir 'start.ps1')
