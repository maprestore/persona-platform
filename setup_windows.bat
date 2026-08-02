@echo off
title Persona Studio - Windows Setup
cd /d "%~dp0"
color 0B

echo ============================================
echo    Persona Studio - Windows Installer
echo ============================================
echo.

:: Check Python
echo [1/5] Checking Python...
py -3 --version >nul 2>&1
if %errorlevel% equ 0 (
    set PYTHON=py -3
    goto :found_python
)
python --version >nul 2>&1
if %errorlevel% equ 0 (
    set PYTHON=python
    goto :found_python
)
echo [ERROR] Python not found!
echo.
echo Download from: https://python.org/downloads/
echo Check "Add Python to PATH" during install.
echo.
pause
exit /b 1

:found_python
%PYTHON% --version
echo.

:: Create virtual environment
echo [2/5] Creating virtual environment...
if not exist ".venv" (
    %PYTHON% -m venv .venv
    echo Created .venv
) else (
    echo Virtual environment exists
)
echo.

:: Use venv Python directly
echo [3/5] Activating environment...
set "VENV_PYTHON=.venv\Scripts\python.exe"
if not exist "%VENV_PYTHON%" (
    echo Venv Python not found. Recreating venv...
    %PYTHON% -m venv .venv --clear
)
if not exist "%VENV_PYTHON%" (
    echo [ERROR] Failed to create venv. Try deleting .venv and running again.
    pause
    exit /b 1
)
echo OK
echo.

:: Upgrade pip
echo [4/5] Upgrading pip...
"%VENV_PYTHON%" -m ensurepip --upgrade >nul 2>&1
"%VENV_PYTHON%" -m pip install --upgrade pip setuptools wheel --quiet
echo.

:: Install all dependencies
echo [5/5] Installing dependencies (this may take 5-10 minutes)...
echo.

echo [5a] Installing core packages...
"%VENV_PYTHON%" -m pip install --quiet numpy opencv-python pillow scipy librosa soundfile

echo [5b] Installing PyTorch...
"%VENV_PYTHON%" -m pip install --quiet torch torchvision --index-url https://download.pytorch.org/whl/cpu

echo [5c] Installing AI inference...
"%VENV_PYTHON%" -m pip install --quiet onnxruntime insightface

echo [5d] Installing face enhancement...
"%VENV_PYTHON%" -m pip install --quiet gfpgan

echo [5e] Installing audio packages...
"%VENV_PYTHON%" -m pip install --quiet pydub torchcrepe openai-whisper

echo [5f] Installing background removal...
"%VENV_PYTHON%" -m pip install --quiet rembg

echo [5g] Installing hand tracking...
"%VENV_PYTHON%" -m pip install --quiet mediapipe

echo [5h] Installing project packages...
"%VENV_PYTHON%" -m pip install --quiet -e packages\shared
"%VENV_PYTHON%" -m pip install --quiet -e packages\persona-swap-core
"%VENV_PYTHON%" -m pip install --quiet -e packages\sdk
"%VENV_PYTHON%" -m pip install --quiet -e packages\magiclip

echo.
echo ============================================
echo    Installation Complete!
echo ============================================
echo.
echo Starting Persona Studio...
echo.

:: Start server
"%VENV_PYTHON%" run_persona.py --skip-install

pause
