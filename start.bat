@echo off
title Persona Studio
cd /d "%~dp0"

:: One-click launcher for Windows

if exist ".venv\Scripts\python.exe" (
    .venv\Scripts\python.exe run_persona.py %*
    pause
    exit /b %errorlevel%
)

py -3 --version >nul 2>&1
if %errorlevel% equ 0 (
    py -3 run_persona.py %*
    pause
    exit /b %errorlevel%
)

python --version >nul 2>&1
if %errorlevel% equ 0 (
    python run_persona.py %*
    pause
    exit /b %errorlevel%
)

echo [ERROR] Python not found.
echo Download from https://python.org/downloads/
echo Make sure to check "Add Python to PATH" during install.
pause
exit /b 1
