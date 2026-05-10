@echo off
echo ====================================================
echo   AGNIRAKHSA PRODUCTION DEPLOYMENT SCRIPT
echo ====================================================
echo.

:: 1. Build Frontend
echo [1/3] Membangun Frontend (Vite Build)...
cd web
call npm run build
if %errorlevel% neq 0 (
    echo GAGAL: Terjadi kesalahan saat build frontend.
    pause
    exit /b %errorlevel%
)
cd ..

:: 2. Jalankan Backend dengan PM2
echo [2/3] Menjalankan Backend di Background via PM2...
:: Menyesuaikan dengan nama folder Anda (Backend)
cd Backend
call pm2 delete agni-backend >nul 2>&1
call pm2 start "python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4" --name agni-backend
cd ..

:: 3. Jalankan Frontend dengan PM2
echo [3/3] Menjalankan Frontend di Background via PM2...
cd web
call pm2 delete agni-frontend >nul 2>&1
call pm2 serve dist 5173 --name agni-frontend --spa
cd ..

echo.
echo ====================================================
echo   SUKSES! Aplikasi berjalan di background.
echo   - Backend: http://localhost:8000
echo   - Frontend: http://localhost:5173
echo.
echo   Gunakan command 'pm2 list' untuk melihat status.
echo   Gunakan command 'pm2 logs' untuk melihat log.
echo   Tekan CTRL+C untuk keluar dari script ini.
echo ====================================================
pause
