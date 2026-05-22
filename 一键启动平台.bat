@echo off
setlocal

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or not in PATH.
  echo Please install Node.js from https://nodejs.org/
  pause
  exit /b 1
)

cd /d "%~dp0"
if errorlevel 1 (
  echo Invalid script directory path:
  echo %~dp0
  pause
  exit /b 1
)

start "TeachingPlatformServer" cmd /k node server.js
timeout /t 2 >nul
start "" "http://localhost:5173/studio_teaching_strict_demo.html"

echo Server start command sent.
echo If the browser did not open, use:
echo http://localhost:5173/studio_teaching_strict_demo.html
pause

exit /b 0
