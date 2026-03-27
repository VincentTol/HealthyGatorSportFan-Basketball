# HealthyGatorSportsFan Django Run Script (Windows)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Set-Location -Path $PSScriptRoot

$venvPath = Join-Path $PSScriptRoot "venv\Scripts\Activate.ps1"
$venvPython = Join-Path $PSScriptRoot "venv\Scripts\python.exe"
$celeryExe = Join-Path $PSScriptRoot "venv\Scripts\celery.exe"

if (-not (Test-Path $venvPython)) {
    throw "Virtual environment not found. Run .\setup.ps1 first."
}

Write-Host "=========================================="
Write-Host "HealthyGatorSportsFan Django Services"
Write-Host "=========================================="

$redisService = Get-Service -Name Redis -ErrorAction SilentlyContinue
if ($null -ne $redisService) {
    Write-Host "Force restarting Redis Windows service..."
    try {
        if ($redisService.Status -eq 'Running') {
            Stop-Service -Name Redis -Force -ErrorAction Stop
            Start-Sleep -Seconds 1
        }

        Start-Service -Name Redis -ErrorAction Stop
        Start-Sleep -Seconds 1
        Write-Host "Redis service restarted and running on localhost:6379."
    } catch {
        Write-Warning "Current shell lacks permission to restart Redis service. Requesting elevation..."
        try {
            $elevatedCommand = @'
try {
    Stop-Service -Name Redis -Force -ErrorAction Stop
    Start-Sleep -Seconds 1
    Start-Service -Name Redis -ErrorAction Stop
    Write-Host 'Redis service restart completed.'
    exit 0
} catch {
    Write-Host "Redis restart failed: $($_.Exception.Message)"
    Read-Host 'Press Enter to close this window'
    exit 1
}
'@
            $elevated = Start-Process powershell -Verb RunAs -Wait -PassThru -ArgumentList @(
                "-NoProfile",
                "-ExecutionPolicy", "Bypass",
                "-Command", $elevatedCommand
            )

            if ($elevated.ExitCode -eq 0) {
                Start-Sleep -Seconds 1
                $redisServiceAfter = Get-Service -Name Redis -ErrorAction SilentlyContinue
                if ($null -ne $redisServiceAfter -and $redisServiceAfter.Status -eq 'Running') {
                    Write-Host "Redis service restarted and running on localhost:6379."
                } else {
                    Write-Warning "Elevated command exited successfully, but Redis service is not running."
                }
            } else {
                Write-Warning "Elevated Redis restart exited with code $($elevated.ExitCode)."
            }
        } catch {
            Write-Warning "Could not restart Redis service (UAC may have been canceled)."
            Write-Host "Run this script in an elevated PowerShell, or run these commands manually:"
            Write-Host "  Stop-Service -Name Redis -Force"
            Write-Host "  Start-Service -Name Redis"
        }
    }
} else {
    $redisUp = Test-NetConnection -ComputerName localhost -Port 6379 -InformationLevel Quiet
    if (-not $redisUp) {
        Write-Warning "Redis does not appear to be running on localhost:6379"

        $redisInstallDir = "C:\Program Files\Redis"
        $redisServerExe = Join-Path $redisInstallDir "redis-server.exe"

        if (Test-Path $redisServerExe) {
            Write-Host "Starting Redis server in a new elevated PowerShell window..."
            try {
                Start-Process powershell -Verb RunAs -ArgumentList @(
                    "-NoExit",
                    "-ExecutionPolicy", "Bypass",
                    "-Command", "Set-Location '$redisInstallDir'; .\redis-server.exe"
                ) | Out-Null

                Write-Host "If Redis shows '# Creating Server TCP listening socket *:6379: No such file or directory', run this in the Redis window:"
                Write-Host "  .\redis-cli.exe"
                Write-Host "  shutdown"
                Write-Host "  (Ctrl+C to exit, then rerun .\redis-server.exe)"
                Start-Sleep -Seconds 2
            } catch {
                Write-Warning "Could not launch elevated Redis window (UAC may have been canceled)."
                Write-Host "Start Redis manually in admin PowerShell:"
                Write-Host "  Set-Location 'C:\Program Files\Redis'"
                Write-Host "  .\redis-server.exe"
            }
        } else {
            Write-Warning "redis-server.exe not found at C:\Program Files\Redis"
            Write-Host "Install Redis or update this script with your Redis install path."
        }
    } else {
        Write-Host "Redis is already running on localhost:6379; skipping Redis startup."
    }
}

if (Test-Path $celeryExe) {
    Write-Host "Starting Celery worker in a new PowerShell window..."
    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-ExecutionPolicy", "Bypass",
        "-Command", "Set-Location '$PSScriptRoot'; . '$venvPath'; celery -A project worker --pool=solo -l info"
    )

    Write-Host "Starting Celery beat in a new PowerShell window..."
    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-ExecutionPolicy", "Bypass",
        "-Command", "Set-Location '$PSScriptRoot'; . '$venvPath'; celery -A project beat --loglevel=info"
    )
} else {
    Write-Warning "Celery executable not found in venv; skipping Celery startup."
}

if (Get-Command ngrok -ErrorAction SilentlyContinue) {
    Write-Host "Starting ngrok in a new PowerShell window..."
    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-ExecutionPolicy", "Bypass",
        "-Command", "Set-Location '$PSScriptRoot'; ngrok http 8000 --url https://nannie-halogenous-tidily.ngrok-free.dev"
    )
} else {
    Write-Warning "ngrok is not on PATH; skipping ngrok startup."
}

Write-Host "Starting Django server (this window)..."
& $venvPython manage.py runserver 0.0.0.0:8000
