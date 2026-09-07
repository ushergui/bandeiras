@echo off
title Detetive Global - jogo (local)
cd /d "%~dp0.."

echo ============================================================
echo   DETETIVE GLOBAL - servidor local do jogo
echo ------------------------------------------------------------
echo   O navegador abre sozinho em http://localhost:8010
echo.
echo   Deixe ESTA JANELA ABERTA enquanto estiver testando.
echo   Para desligar: feche a janela ou aperte Ctrl+C.
echo ============================================================
echo.

rem abre o navegador depois de ~3s
start "abrir navegador" /min cmd /c "ping -n 4 127.0.0.1 >nul & start "" http://localhost:8010/"

python -m http.server 8010

echo.
echo Servidor encerrado.
pause
