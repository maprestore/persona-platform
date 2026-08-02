# Persona Studio - Windows PowerShell Launcher
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$VenvPython = Join-Path $ScriptDir ".venv\Scripts\python.exe"

if (Test-Path $VenvPython) {
    & $VenvPython run_persona.py @args
    exit $LASTEXITCODE
}

function Test-Command($cmd) {
    try { & $cmd --version 2>&1 | Out-Null; return $LASTEXITCODE -eq 0 }
    catch { return $false }
}

if (Test-Command "py") {
    & py -3 run_persona.py @args
} elseif (Test-Command "python") {
    & python run_persona.py @args
} else {
    Write-Host "[ERROR] Python not found." -ForegroundColor Red
    Write-Host "Download from https://python.org/downloads/" -ForegroundColor Red
    Write-Host "Make sure to check 'Add Python to PATH' during install." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

exit $LASTEXITCODE
