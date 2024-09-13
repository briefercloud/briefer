@echo off
SETLOCAL

REM Get the directory of the script
SET "SCRIPT_DIR=%~dp0"

REM Ensure the public directory exists
IF NOT EXIST "%SCRIPT_DIR%public\" (
    MKDIR "%SCRIPT_DIR%public"
)

REM Write to env.js
(
    ECHO window.env = {};
    ECHO window.env.NEXT_PUBLIC_API_URL = '%NEXT_PUBLIC_API_URL%';
    ECHO window.env.NEXT_PUBLIC_API_WS_URL = '%NEXT_PUBLIC_API_WS_URL%';
    ECHO window.env.NEXT_PUBLIC_PUBLIC_URL = '%NEXT_PUBLIC_PUBLIC_URL%';
) > "%SCRIPT_DIR%public\env.js"

REM Run the server.js script with Node.js
node "%SCRIPT_DIR%server.js"