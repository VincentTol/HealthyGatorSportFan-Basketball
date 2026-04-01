# HealthyGatorSportsFan Django Run Script (Windows)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Set-Location -Path $PSScriptRoot

$venvPath = Join-Path $PSScriptRoot "venv\Scripts\Activate.ps1"
$venvPython = Join-Path $PSScriptRoot "venv\Scripts\python.exe"
$celeryExe = Join-Path $PSScriptRoot "venv\Scripts\celery.exe"
$envFilePath = Join-Path $PSScriptRoot ".env"

$redisUrl = "redis://localhost:6379/0"
if (Test-Path $envFilePath) {
    $redisLine = Get-Content -Path $envFilePath | Where-Object { $_ -match '^REDIS_URL=' } | Select-Object -First 1
    if ($redisLine) {
        $redisUrl = $redisLine.Substring("REDIS_URL=".Length).Trim()
    }
}

$redisPort = 6379
if ($redisUrl -match ':(\d+)/\d+$') {
    $redisPort = [int]$Matches[1]
}

if (-not (Test-Path $venvPython)) {
    throw "Virtual environment not found. Run .\setup.ps1 first."
}

Write-Host "=========================================="
Write-Host "HealthyGatorSportsFan Django Services"
Write-Host "=========================================="

function Wait-ForRedis {
    param(
        [int]$Port,
        [int]$TimeoutSeconds = 30
    )

    $start = Get-Date
    while (((Get-Date) - $start).TotalSeconds -lt $TimeoutSeconds) {
        $redisListening = Test-NetConnection -ComputerName localhost -Port $Port -InformationLevel Quiet
        if ($redisListening) {
            return $true
        }
        Start-Sleep -Seconds 1
    }

    return $false
}

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
        Write-Host "Redis service restarted. Expecting Redis at localhost:$redisPort."
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
                    Write-Host "Redis service restarted. Expecting Redis at localhost:$redisPort."
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
    $redisUp = Test-NetConnection -ComputerName localhost -Port $redisPort -InformationLevel Quiet
    if (-not $redisUp) {
        Write-Warning "Redis does not appear to be running on localhost:$redisPort"

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

                Write-Host "If Redis starts but app still cannot connect, verify REDIS_URL in .env and Redis service port."
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
        Write-Host "Redis is already running on localhost:$redisPort; skipping Redis startup."
    }
}

$redisReady = Wait-ForRedis -Port $redisPort -TimeoutSeconds 30
if (-not $redisReady) {
    Write-Warning "Redis is not reachable on localhost:$redisPort after waiting 30 seconds."
    Write-Warning "Skipping Celery startup. Start Redis, then run:"
    Write-Host "  .\venv\Scripts\Activate.ps1"
    Write-Host "  celery -A project worker --pool=solo -l info"
    Write-Host "  celery -A project beat --loglevel=info"
}
elseif (Test-Path $celeryExe) {
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
        "-Command", "Set-Location '$PSScriptRoot'; ngrok http 8000 --url nannie-halogenous-tidily.ngrok-free.dev"
    )
} else {
    Write-Warning "ngrok is not on PATH; skipping ngrok startup."
}

Write-Host "Starting Django server (this window)..."
& $venvPython manage.py runserver 0.0.0.0:8000
