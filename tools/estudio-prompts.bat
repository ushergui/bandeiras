@echo off
title Estudio de Prompts das Figurinhas - Detetive Global
cd /d "%~dp0.."

echo ============================================================
echo   ESTUDIO DE PROMPTS DAS FIGURINHAS
echo ------------------------------------------------------------
echo   O servidor esta subindo (leva ~5 segundos).
echo   O navegador abre sozinho em http://localhost:5002
echo.
echo   Deixe ESTA JANELA ABERTA enquanto estiver gerando imagens.
echo   Para desligar: feche a janela ou aperte Ctrl+C.
echo ============================================================
echo.

rem abre o navegador depois de ~6s, sem travar o servidor
start "abrir navegador" /min cmd /c "ping -n 7 127.0.0.1 >nul & start "" http://localhost:5002/"

"venv\Scripts\python.exe" "tools\prompts_studio.py"

echo.
echo Servidor encerrado.
pause
