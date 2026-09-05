@echo off
title Estudio de Voz (OmniVoice) - Detetive Global
cd /d "%~dp0.."

echo ============================================================
echo   ESTUDIO DE VOZ (OmniVoice)
echo ------------------------------------------------------------
echo   O modelo carrega UMA vez (~3 minutos na primeira). Aguarde
echo   a mensagem "modelo pronto" -- o navegador abre sozinho em
echo   http://localhost:5001
echo.
echo   Deixe ESTA JANELA ABERTA enquanto estiver gerando audios.
echo   Para desligar: feche a janela ou aperte Ctrl+C.
echo ============================================================
echo.

rem abre o navegador depois de ~4 min (tempo de carregar o modelo)
start "abrir navegador" /min cmd /c "ping -n 200 127.0.0.1 >nul & start "" http://localhost:5001/"

"venv\Scripts\python.exe" "tools\voz_studio.py"

echo.
echo Servidor encerrado.
pause
