Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Set-Location -Path $PSScriptRoot

Write-Host "=========================================="
Write-Host "HealthyGatorSportsFan Frontend"
Write-Host "=========================================="

if (-not (Test-Path "node_modules")) {
    Write-Host "Dependencies missing. Running setup..."
    .\setup.ps1
}

Write-Host "Starting Expo development server..."
Write-Host "Press 'a' for Android emulator, 'w' for web, Ctrl+C to stop."
npx expo start
