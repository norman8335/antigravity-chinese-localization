@echo off
chcp 65001 >nul
set "antigravity_exe=%LOCALAPPDATA%\Programs\antigravity\Antigravity.exe"
if not exist "%antigravity_exe%" (
  echo 未找到默认路径的 Antigravity，请先运行 install_chinese.bat 安装汉化，再使用原快捷方式启动。
  pause
  exit /b 1
)
tasklist /FI "IMAGENAME eq Antigravity.exe" /NH 2>nul | find /I "Antigravity.exe" >nul
if not errorlevel 1 goto launch
node "%~dp0patch.mjs" install
if errorlevel 1 (
  pause
  exit /b 1
)
:launch
start "" "%antigravity_exe%"
