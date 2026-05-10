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

:: 2. Jalankan Semuanya dengan PM2 Ecosystem
echo [2/3] Menjalankan Backend ^& Frontend via PM2 Ecosystem...
call pm2 delete all >nul 2>&1
call pm2 start ecosystem.config.js
echo.

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
