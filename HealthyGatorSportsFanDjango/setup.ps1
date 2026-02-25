# HealthyGatorSportsFan Django Setup Script (Windows)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Set-Location -Path $PSScriptRoot

function Get-PythonCommand {
    if (Get-Command py -ErrorAction SilentlyContinue) {
        return "py"
    }
    if (Get-Command python -ErrorAction SilentlyContinue) {
        return "python"
    }
    throw "Python is not installed or not on PATH."
}

Write-Host "=========================================="
Write-Host "HealthyGatorSportsFan Django Setup (Windows)"
Write-Host "=========================================="

$pythonCmd = Get-PythonCommand

if (-not (Test-Path "venv")) {
    Write-Host "Creating virtual environment..."
    & $pythonCmd -m venv venv
    Write-Host "[OK] Virtual environment created"
} else {
    Write-Host "[OK] Virtual environment already exists"
}

$venvPython = Join-Path $PSScriptRoot "venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
    throw "Virtual environment python executable not found at $venvPython"
}

Write-Host "Upgrading pip..."
& $venvPython -m pip install --upgrade pip

Write-Host "Installing requirements..."
& $venvPython -m pip install -r requirements.txt

Write-Host "Installing additional package (argon2-cffi)..."
& $venvPython -m pip install argon2-cffi

$envPath = Join-Path $PSScriptRoot ".env"
if (-not (Test-Path $envPath)) {
    Write-Host "Creating .env file..."
    $secretKey = & $venvPython -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
    $envContent = @"
SECRET_KEY=$secretKey
DEBUG=True
DATABASE_NAME=healthygatorsportsfan
DATABASE_USER=postgres
DATABASE_PASSWORD=your_password_here
DATABASE_HOST=localhost
DATABASE_PORT=5432
"@
    $envContent | Out-File -FilePath $envPath -Encoding UTF8
    Write-Host "[OK] .env file created"
    Write-Host "[WARN] Update DATABASE_USER and DATABASE_PASSWORD in .env"
} else {
    Write-Host "[OK] .env already exists"
}

Write-Host "Attempting migrations..."
$migrationsOk = $true
try {
    & $venvPython manage.py makemigrations
    & $venvPython manage.py migrate
    Write-Host "[OK] Migrations completed"
} catch {
    $migrationsOk = $false
    Write-Warning "Could not complete migrations (likely DB not ready yet)."
    Write-Host "You can run later after DB setup:"
    Write-Host "  .\venv\Scripts\Activate.ps1"
    Write-Host "  py manage.py migrate"
}

if ($migrationsOk) {
    $createSuper = Read-Host "Create superuser now? (y/n)"
    if ($createSuper -match '^[Yy]') {
        & $venvPython manage.py createsuperuser
    }
}

Write-Host ""
Write-Host "=========================================="
Write-Host "Setup Complete"
Write-Host "=========================================="
Write-Host "Next: run .\run.ps1"
