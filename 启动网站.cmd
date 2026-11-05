@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20+ is required for the local server.
  echo You can open index.html directly without Node.js.
  pause
  exit /b 1
)
node server.cjs
if errorlevel 1 pause
