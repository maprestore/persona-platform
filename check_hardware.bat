@echo off
echo.
echo   Persona Platform - Hardware Check
echo   =================================
echo.

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo   [ERROR] Python not found! Install Python 3.10+
    echo   https://www.python.org/downloads/
    echo.
    pause
    exit /b 1
)

python "%~dp0check_hardware.py"
echo.
pause
