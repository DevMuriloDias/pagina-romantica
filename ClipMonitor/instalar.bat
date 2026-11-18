@echo off
rem Instala o ClipMonitor: cria o ambiente .venv e as dependencias (uma vez).
chcp 65001 >nul
cd /d "%~dp0"

py -3.11 --version >nul 2>nul
if errorlevel 1 (
  echo Python 3.11 nao encontrado. Instale em https://www.python.org/downloads/ marcando "Add python.exe to PATH".
  pause
  exit /b 1
)

if not exist .venv\Scripts\python.exe (
  echo Criando ambiente virtual .venv ...
  py -3.11 -m venv .venv || (echo Falha ao criar o ambiente. & pause & exit /b 1)
)

echo Instalando dependencias (pode levar alguns minutos)...
.venv\Scripts\python.exe -m pip install --upgrade pip
.venv\Scripts\python.exe -m pip install -r requirements.txt || (echo Falha ao instalar dependencias. & pause & exit /b 1)

where ffmpeg >nul 2>nul
if errorlevel 1 (
  echo.
  echo AVISO: FFmpeg nao foi encontrado no PATH.
  echo Baixe "ffmpeg-release-full" em https://www.gyan.dev/ffmpeg/builds/, extraia e adicione a pasta "bin" ao PATH.
)

echo.
echo Instalacao concluida. Abra o ClipMonitor com ClipMonitor.bat
pause
