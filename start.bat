@echo off
echo Starting CyberOutbreak Simulator...

:: Check if Python is installed
python --version >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo Python could not be found. Please install Python to run the server.
    pause
    exit /b
)

:: Set up virtual environment
IF NOT EXIST "venv" (
    echo Creating Python virtual environment...
    python -m venv venv
)

:: Activate virtual environment
call venv\Scripts\activate.bat

:: Install dependencies
echo Installing/verifying dependencies...
python -m pip install -r requirements.txt -q

:: Start the server in the background
echo Starting server on port 8000...
start /B python server.py

:: Wait for server to boot
timeout /t 2 /nobreak >nul

:: Open browser
start http://127.0.0.1:8000

echo Server running. Close this window to stop the server, or press Ctrl+C.
pause
