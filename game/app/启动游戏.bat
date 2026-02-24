@echo off
chcp 437 >nul
title Game Launcher

set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
set "LOGFILE=%SCRIPT_DIR%\start_log.txt"

echo ============================================
echo      Game Launcher
echo ============================================
echo.

echo [%date% %time%] Start > "%LOGFILE%"

REM Check Node.js
node -v >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Please install from https://nodejs.org/
    pause
    exit /b 1
)
echo [OK] Node.js installed

REM Check server folder
if not exist "%SCRIPT_DIR%\server" (
    echo [ERROR] server folder not found at: %SCRIPT_DIR%\server
    pause
    exit /b 1
)
echo [OK] server folder found

REM Get IP
set "LOCAL_IP=127.0.0.1"
for /f "tokens=2 delims=[]" %%a in ('ping -4 -n 1 %computername% 2^>nul ^| findstr "["') do (
    set "LOCAL_IP=%%a"
    goto got_ip
)
:got_ip
echo [OK] IP: %LOCAL_IP%
echo.

REM Start WebSocket Server
echo [1/3] Starting WebSocket Server...
cd /d "%SCRIPT_DIR%\server"
if errorlevel 1 (
    echo [ERROR] Cannot enter server folder
    pause
    exit /b 1
)

echo     Installing dependencies...
call npm install >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    echo [ERROR] npm install failed for server
    echo Check log: %LOGFILE%
    pause
    exit /b 1
)

start "WebSocket-Server" cmd /k "cd /d "%SCRIPT_DIR%\server" && node websocket-server.js"
echo     WebSocket Server started
timeout /t 3 /nobreak >nul

REM Start Frontend
echo [2/3] Starting Frontend Server...
cd /d "%SCRIPT_DIR%"
if errorlevel 1 (
    echo [ERROR] Cannot enter project folder
    pause
    exit /b 1
)

echo     Installing dependencies...
call npm install >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    echo [ERROR] npm install failed for frontend
    echo Check log: %LOGFILE%
    pause
    exit /b 1
)

start "Frontend-Server" cmd /k "cd /d "%SCRIPT_DIR%" && npm run dev"
echo     Frontend Server started
timeout /t 5 /nobreak >nul

REM Open Browser
echo [3/3] Opening browser...
start http://localhost:5173

echo.
echo ============================================
echo              READY!
echo ============================================
echo Host:     http://localhost:5173
echo WebSocket: ws://%LOCAL_IP%:8080
echo.
echo Press any key to stop all services...
pause >nul

REM Stop services
echo.
echo Stopping services...
taskkill /FI "WINDOWTITLE eq WebSocket*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Frontend*" /F >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1
echo Services stopped.
timeout /t 2 /nobreak >nul