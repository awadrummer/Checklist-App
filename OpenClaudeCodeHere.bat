@echo off
cd /d %~dp0

REM Start Claude Chat without transcript logging
start "Claude Chat" cmd /k claude

REM Start Claude Monitor without transcript logging
start "Claude Monitor" cmd /k claude-monitor

REM Immediately exit this window
exit
