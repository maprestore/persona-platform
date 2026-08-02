@echo off
title Persona - System Check
cd /d "%~dp0"
echo Running system check...
echo.
.venv\Scripts\python.exe check.py
echo.
pause