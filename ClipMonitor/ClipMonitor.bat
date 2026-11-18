@echo off
rem Abre o ClipMonitor sem janela de console. Argumentos opcionais: --minimized --no-monitor
cd /d "%~dp0"
if not exist .venv\Scripts\pythonw.exe (
  echo Execute instalar.bat primeiro.
  pause
  exit /b 1
)
start "" .venv\Scripts\pythonw.exe main.py %*
