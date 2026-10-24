@echo off
chcp 65001 >nul
node "%~dp0patch.mjs" status %*
pause
