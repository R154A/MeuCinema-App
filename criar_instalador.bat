@echo off
setlocal
cd /d "%~dp0"
title Meu Cinema - criando o instalador
echo.
echo ===== Meu Cinema: criando o instalador (MeuCinemaSetup.exe) =====
echo.

where python >nul 2>nul
if errorlevel 1 goto sempython

echo [1/4] Instalando dependencias do projeto...
python -m pip install --upgrade pip >nul 2>nul
python -m pip install -r requirements.txt
if errorlevel 1 goto erro

echo.
echo [2/4] Empacotando o app (Python e bibliotecas embutidos)...
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist
python -m PyInstaller --noconfirm --clean --windowed --name MeuCinema --icon icon.ico --collect-all webview --add-data "web;web" app.py
if errorlevel 1 goto erro
if not exist "dist\MeuCinema\MeuCinema.exe" goto erro

echo.
echo [3/4] Baixando o componente WebView2 da Microsoft (so na 1a vez)...
if exist "installer\MicrosoftEdgeWebview2Setup.exe" goto temwv2
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://go.microsoft.com/fwlink/p/?LinkId=2124703' -OutFile 'installer\MicrosoftEdgeWebview2Setup.exe'"
if errorlevel 1 goto erro
:temwv2

echo.
echo [4/4] Montando o instalador...
call :acharinno
if defined ISCC goto compilar
echo Inno Setup nao encontrado. Tentando instalar automaticamente (winget)...
winget install -e --id JRSoftware.InnoSetup --accept-source-agreements --accept-package-agreements --silent
call :acharinno
if defined ISCC goto compilar
goto semisinno

:compilar
"%ISCC%" "installer\MeuCinema.iss"
if errorlevel 1 goto erro
copy /y "installer\Output\MeuCinemaSetup.exe" "MeuCinemaSetup.exe" >nul
echo.
echo ================================================================
echo  PRONTO!  O instalador esta aqui:
echo  %~dp0MeuCinemaSetup.exe
echo ================================================================
echo.
pause
exit /b 0

:acharinno
set "ISCC="
if exist "%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe" set "ISCC=%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe"
if exist "%ProgramFiles%\Inno Setup 6\ISCC.exe" set "ISCC=%ProgramFiles%\Inno Setup 6\ISCC.exe"
if exist "%LocalAppData%\Programs\Inno Setup 6\ISCC.exe" set "ISCC=%LocalAppData%\Programs\Inno Setup 6\ISCC.exe"
exit /b 0

:sempython
echo Python nao encontrado. Instale em python.org e marque "Add Python to PATH".
goto fim
:semisinno
echo.
echo Nao consegui instalar o Inno Setup sozinho.
echo Baixe e instale (gratis) em  https://jrsoftware.org/isdl.php  e rode este arquivo de novo.
goto fim
:erro
echo.
echo Algo deu errado. Leia as mensagens acima.
:fim
echo.
pause
exit /b 1
