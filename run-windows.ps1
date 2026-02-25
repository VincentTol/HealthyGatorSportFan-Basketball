Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$backendRun = Join-Path $root "HealthyGatorSportsFanDjango\run.ps1"
$frontendRun = Join-Path $root "HealthyGatorSportsFanRN\run.ps1"

if (-not (Test-Path $backendRun)) {
    throw "Backend run script not found: $backendRun"
}
if (-not (Test-Path $frontendRun)) {
    throw "Frontend run script not found: $frontendRun"
}

Write-Host "Launching backend and frontend in separate PowerShell windows..."

Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy", "Bypass",
    "-File", "`"$backendRun`""
)

Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy", "Bypass",
    "-File", "`"$frontendRun`""
)

Write-Host "Launched."
