@echo off
REM ============================================================
REM  SIREN HEAD: TORONTO NIGHT  -  one-click launcher
REM  Starts a tiny local web server and opens the game.
REM ============================================================
cd /d "%~dp0"
title Siren Head Server

where python >nul 2>nul && (set "PYCMD=python") || (set "PYCMD=py")

echo Starting local server on http://127.0.0.1:8099 ...
start "Siren Head Server" /min cmd /c "%PYCMD% -m http.server 8099 --bind 127.0.0.1"

REM give the server a moment to come up, then open the game
timeout /t 2 >nul
start "" "http://127.0.0.1:8099/index.html"

echo.
echo  Game opened in your browser.
echo  Keep this window (or the minimized "Siren Head Server" window) open while playing.
echo  Close it to stop the server.
echo.
pause
