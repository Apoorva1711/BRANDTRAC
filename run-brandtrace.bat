@echo off
echo ===================================================
echo   Starting BRANDTRACE Full-Stack Application
echo ===================================================
echo.

echo 1. Starting Python Detection Service (Port 8001)...
if exist "detection-service\venv\Scripts\python.exe" (
  start "BRANDTRACE Detection Service" cmd /k "cd detection-service && venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001"
) else (
  start "BRANDTRACE Detection Service" cmd /k "cd detection-service && python -m uvicorn app.main:app --host 127.0.0.1 --port 8001"
)

timeout /t 3 /nobreak > nul

echo 2. Starting Backend API Server (Port 5000)...
start "BRANDTRACE Backend API" cmd /k "cd server && npm run dev"

timeout /t 3 /nobreak > nul

echo 3. Starting Frontend Client (Port 5173)...
start "BRANDTRACE Frontend Client" cmd /k "cd client && npm run dev"

echo.
echo ===================================================
echo Services launching!
echo - Detection Microservice: http://127.0.0.1:8001/health
echo - Backend API: http://localhost:5000/api/health
echo - Frontend UI: http://localhost:5173
echo.
echo Login Credentials:
echo - Email: analyst@brandtrace.local
echo - Password: Analyst@1234
echo ===================================================
