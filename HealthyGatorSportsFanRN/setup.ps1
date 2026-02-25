Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Set-Location -Path $PSScriptRoot

Write-Host "=========================================="
Write-Host "HealthyGatorSportsFan Frontend Setup (Windows)"
Write-Host "=========================================="

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js is not installed. Install from https://nodejs.org/"
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm is not installed."
}

Write-Host "Node: $(node --version)"
Write-Host "npm: $(npm --version)"

Write-Host "Installing npm dependencies..."
npm install

Write-Host "Installing Expo packages..."
npx expo install react-native-web
npx expo install expo-web-browser

Write-Host "Installing TypeScript typings..."
npm install --save-dev @types/react @types/react-native

$appUrls = Join-Path $PSScriptRoot "constants\AppUrls.ts"
if (Test-Path $appUrls) {
    Write-Host "Review backend URL in constants\AppUrls.ts before running app."
}

Write-Host ""
Write-Host "=========================================="
Write-Host "Setup Complete"
Write-Host "=========================================="
Write-Host "Next: run .\run.ps1"
