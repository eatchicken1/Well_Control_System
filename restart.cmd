@echo off
setlocal

rem PowerShell may block direct .ps1 invocation under RemoteSigned/AllSigned.
rem Always launch the restart script through a process-scoped bypass and pass
rem its exit code back to the caller.
set "PS_EXE=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PS_EXE%" set "PS_EXE=powershell.exe"

"%PS_EXE%" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%~dp0restart.ps1"
set "EXIT_CODE=%ERRORLEVEL%"
endlocal & exit /b %EXIT_CODE%
