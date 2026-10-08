@echo off
chcp 65001 >nul
echo === Meu Cinema: gerando o executavel ===
python -m pip install --upgrade pip
python -m pip install -r requirements.txt || goto erro
python -m PyInstaller --noconfirm --clean --windowed --onefile --name MeuCinema --icon icon.ico --collect-all webview --add-data "web;web" app.py || goto erro
echo.
echo Pronto! Seu programa esta em: dist\MeuCinema.exe
pause
exit /b 0
:erro
echo Algo deu errado. Confira se o Python esta instalado (marque "Add to PATH").
pause
