@echo off
echo =========================================
echo Darul Aman Academy - Backend Setup Script
echo =========================================

echo.
echo Installing dependencies...
call npm install

echo.
echo Generating Prisma client...
call npx prisma generate

echo.
echo Running database migrations...
call npx prisma migrate dev --name init

echo.
echo Seeding database with demo data...
call node prisma/seed.js

echo.
echo =========================================
echo Setup complete! Starting the server...
echo =========================================
echo.
call npm run dev
