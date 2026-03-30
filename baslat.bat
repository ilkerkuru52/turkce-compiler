@echo off
setlocal enabledelayedexpansion

echo.
echo ========================================
echo        ILKER STUDIO IDE LAUNCHER
echo ========================================
echo.

:: 1. Clear Port 3000
echo [1/2] Checking Port 3000...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr :3000') do (
    set "PID=%%a"
    if not "!PID!"=="" (
        echo Port 3000 in use by PID !PID!. Closing...
        taskkill /F /PID !PID! > nul 2>&1
    )
)

:: 2. Start Server
echo [2/2] Starting Server...
if not exist "server\index.js" (
    echo [ERROR] server\index.js not found!
    pause
    exit /b 1
)

cd server
if not exist "node_modules" (
    echo Modules missing, installing...
    call npm install --quiet
)

echo.
echo ========================================
echo    Sistem Hazir! Google Chrome Tarayicinda http://localhost:3000 adresine git!
echo    Durdurmak icin bu pencereyi kapat.
echo ========================================
echo.

node index.js
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Server stopped unexpectedly.
    pause
)

pause
