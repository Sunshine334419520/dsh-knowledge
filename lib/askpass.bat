@echo off
rem GIT_ASKPASS shim for Windows (Git for Windows cannot run the .sh one).
rem It only reads env vars, so tokens never reach argv. credential.username
rem is set by the host, so in practice only the password prompt arrives here.
echo %~1 | findstr /I "username" >nul
if errorlevel 1 (echo %DSH_KB_GIT_TOKEN%) else (echo %DSH_KB_GIT_USER%)
