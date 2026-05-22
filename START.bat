@echo off
title Small Business Accounting App
echo.
echo  =========================================
echo   Small Business Accounting App
echo  =========================================
echo.

if not exist node_modules (
  echo  [1/2] Installing server dependencies...
  call npm install
  echo.
)

if not exist client\node_modules (
  echo  [2/2] Installing client dependencies...
  call npm --prefix client install
  echo.
)

echo  Starting app...
echo  Open your browser to: http://localhost:5173
echo.
start "" http://localhost:5173
call npm run dev
pause
