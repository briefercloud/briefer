@echo off
SETLOCAL ENABLEDELAYEDEXPANSION

REM If the .env file does not exist, create one
IF NOT EXIST .env (
  ECHO Enter the top-level domain (e.g., example.com):
  SET /P TLD=

  ECHO TLD=%TLD%> .env

  REM Generate POSTGRES_USERNAME
  FOR /F %%A IN ('powershell -Command "-join ((Get-Random -Minimum 0 -Maximum 15 -Count 24) ^| ForEach-Object { $_.ToString('x') })"') DO SET POSTGRES_USERNAME=%%A
  ECHO POSTGRES_USERNAME=%POSTGRES_USERNAME%>> .env

  REM Generate POSTGRES_PASSWORD
  FOR /F %%A IN ('powershell -Command "-join ((Get-Random -Minimum 0 -Maximum 15 -Count 24) ^| ForEach-Object { $_.ToString('x') })"') DO SET POSTGRES_PASSWORD=%%A
  ECHO POSTGRES_PASSWORD=%POSTGRES_PASSWORD%>> .env

  REM Generate JUPYTER_TOKEN
  FOR /F %%A IN ('powershell -Command "-join ((Get-Random -Minimum 0 -Maximum 15 -Count 48) ^| ForEach-Object { $_.ToString('x') })"') DO SET JUPYTER_TOKEN=%%A
  ECHO JUPYTER_TOKEN=%JUPYTER_TOKEN%>> .env

  REM Generate AI_BASIC_AUTH_USERNAME
  FOR /F %%A IN ('powershell -Command "-join ((Get-Random -Minimum 0 -Maximum 15 -Count 24) ^| ForEach-Object { $_.ToString('x') })"') DO SET AI_BASIC_AUTH_USERNAME=%%A
  ECHO AI_BASIC_AUTH_USERNAME=%AI_BASIC_AUTH_USERNAME%>> .env

  REM Generate AI_BASIC_AUTH_PASSWORD
  FOR /F %%A IN ('powershell -Command "-join ((Get-Random -Minimum 0 -Maximum 15 -Count 24) ^| ForEach-Object { $_.ToString('x') })"') DO SET AI_BASIC_AUTH_PASSWORD=%%A
  ECHO AI_BASIC_AUTH_PASSWORD=%AI_BASIC_AUTH_PASSWORD%>> .env

  ECHO OPENAI_API_KEY=sk-placeholder>> .env

  REM Generate LOGIN_JWT_SECRET
  FOR /F %%A IN ('powershell -Command "-join ((Get-Random -Minimum 0 -Maximum 15 -Count 48) ^| ForEach-Object { $_.ToString('x') })"') DO SET LOGIN_JWT_SECRET=%%A
  ECHO LOGIN_JWT_SECRET=%LOGIN_JWT_SECRET%>> .env

  REM Generate AUTH_JWT_SECRET
  FOR /F %%A IN ('powershell -Command "-join ((Get-Random -Minimum 0 -Maximum 15 -Count 48) ^| ForEach-Object { $_.ToString('x') })"') DO SET AUTH_JWT_SECRET=%%A
  ECHO AUTH_JWT_SECRET=%AUTH_JWT_SECRET%>> .env

  REM Generate ENVIRONMENT_VARIABLES_ENCRYPTION_KEY
  FOR /F %%A IN ('powershell -Command "-join ((Get-Random -Minimum 0 -Maximum 15 -Count 64) ^| ForEach-Object { $_.ToString('x') })"') DO SET ENVIRONMENT_VARIABLES_ENCRYPTION_KEY=%%A
  ECHO ENVIRONMENT_VARIABLES_ENCRYPTION_KEY=%ENVIRONMENT_VARIABLES_ENCRYPTION_KEY%>> .env

  REM Generate WORKSPACE_SECRETS_ENCRYPTION_KEY
  FOR /F %%A IN ('powershell -Command "-join ((Get-Random -Minimum 0 -Maximum 15 -Count 64) ^| ForEach-Object { $_.ToString('x') })"') DO SET WORKSPACE_SECRETS_ENCRYPTION_KEY=%%A
  ECHO WORKSPACE_SECRETS_ENCRYPTION_KEY=%WORKSPACE_SECRETS_ENCRYPTION_KEY%>> .env

  REM Generate DATASOURCES_ENCRYPTION_KEY
  FOR /F %%A IN ('powershell -Command "-join ((Get-Random -Minimum 0 -Maximum 15 -Count 64) ^| ForEach-Object { $_.ToString('x') })"') DO SET DATASOURCES_ENCRYPTION_KEY=%%A
  ECHO DATASOURCES_ENCRYPTION_KEY=%DATASOURCES_ENCRYPTION_KEY%>> .env

  ECHO ENABLE_CUSTOM_OAI_KEY=true>> .env

  ECHO.
  ECHO Here are the URLs you should use to access Briefer:
  ECHO APP: https://app.%TLD%
  ECHO API: https://api.%TLD%
  ECHO.

  PAUSE
)

REM Check if Docker Compose exists
WHERE docker-compose >nul 2>&1
IF %ERRORLEVEL% EQU 0 (
  SET COMPOSE_CMD=docker-compose
) ELSE (
  docker compose version >nul 2>&1
  IF %ERRORLEVEL% EQU 0 (
    SET COMPOSE_CMD=docker compose
  ) ELSE (
    ECHO Neither docker compose nor docker-compose is installed, exiting...
    EXIT /B 1
  )
)

REM Running docker compose up
%COMPOSE_CMD% up -d
