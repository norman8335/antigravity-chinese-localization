@echo off
chcp 65001 >nul
node "%~dp0patch.mjs" restore %*
set "patch_result=%errorlevel%"
pause
exit /b %patch_result%
