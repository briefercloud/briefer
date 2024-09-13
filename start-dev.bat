@echo off
SETLOCAL ENABLEDELAYEDEXPANSION

REM If the .env file does not exist in API, create one
IF NOT EXIST .\apps\api\.env (
  ECHO NODE_ENV=development> .\apps\api\.env
  ECHO LOG_LEVEL=debug>> .\apps\api\.env
  ECHO API_URL='https://localhost:3000'>> .\apps\api\.env
  ECHO FRONTEND_URL='https://localhost:3000'>> .\apps\api\.env
  ECHO TLD=localhost>> .\apps\api\.env

  REM Generate LOGIN_JWT_SECRET
  FOR /F %%A IN ('powershell -Command "-join ((0..9) + (97..102) | Get-Random -Count 48 | %% {[char]$_})"') DO SET LOGIN_JWT_SECRET=%%A
  ECHO LOGIN_JWT_SECRET=!LOGIN_JWT_SECRET!>> .\apps\api\.env

  REM Generate AUTH_JWT_SECRET
  FOR /F %%A IN ('powershell -Command "-join ((0..9) + (97..102) | Get-Random -Count 48 | %% {[char]$_})"') DO SET AUTH_JWT_SECRET=%%A
  ECHO AUTH_JWT_SECRET=!AUTH_JWT_SECRET!>> .\apps\api\.env

  ECHO AI_API_URL='http://localhost:8000'>> .\apps\api\.env

  REM Generate AI_API_USERNAME
  FOR /F %%A IN ('powershell -Command "-join ((0..9) + (97..122) | Get-Random -Count 24 | %% {[char]$_})"') DO SET AI_API_USERNAME=%%A
  ECHO AI_API_USERNAME=!AI_API_USERNAME!>> .\apps\api\.env

  REM Generate AI_API_PASSWORD
  FOR /F %%A IN ('powershell -Command "-join ((0..9) + (97..122) | Get-Random -Count 24 | %% {[char]$_})"') DO SET AI_API_PASSWORD=%%A
  ECHO AI_API_PASSWORD=!AI_API_PASSWORD!>> .\apps\api\.env

  ECHO PYTHON_ALLOWED_LIBRARIES='plotly,matplotlib,numpy,pandas'>> .\apps\api\.env
  ECHO POSTGRES_USERNAME=postgres>> .\apps\api\.env
  ECHO POSTGRES_PASSWORD=password>> .\apps\api\.env
  ECHO POSTGRES_HOSTNAME=localhost>> .\apps\api\.env
  ECHO POSTGRES_PORT=5432>> .\apps\api\.env
  ECHO POSTGRES_DATABASE=briefer>> .\apps\api\.env

  REM Generate ENVIRONMENT_VARIABLES_ENCRYPTION_KEY
  FOR /F %%A IN ('powershell -Command "-join ((0..9) + (97..102) | Get-Random -Count 64 | %% {[char]$_})"') DO SET ENVIRONMENT_VARIABLES_ENCRYPTION_KEY=%%A
  ECHO ENVIRONMENT_VARIABLES_ENCRYPTION_KEY=!ENVIRONMENT_VARIABLES_ENCRYPTION_KEY!>> .\apps\api\.env

  REM Generate DATASOURCES_ENCRYPTION_KEY
  FOR /F %%A IN ('powershell -Command "-join ((0..9) + (97..102) | Get-Random -Count 64 | %% {[char]$_})"') DO SET DATASOURCES_ENCRYPTION_KEY=%%A
  ECHO DATASOURCES_ENCRYPTION_KEY=!DATASOURCES_ENCRYPTION_KEY!>> .\apps\api\.env

  REM Generate WORKSPACE_SECRETS_ENCRYPTION_KEY
  FOR /F %%A IN ('powershell -Command "-join ((0..9) + (97..102) | Get-Random -Count 64 | %% {[char]$_})"') DO SET WORKSPACE_SECRETS_ENCRYPTION_KEY=%%A
  ECHO WORKSPACE_SECRETS_ENCRYPTION_KEY=!WORKSPACE_SECRETS_ENCRYPTION_KEY!>> .\apps\api\.env

  ECHO JUPYTER_HOST=localhost>> .\apps\api\.env
  ECHO JUPYTER_PORT=8888>> .\apps\api\.env

  REM Generate JUPYTER_TOKEN
  FOR /F %%A IN ('powershell -Command "-join ((0..9) + (97..122) | Get-Random -Count 48 | %% {[char]$_})"') DO SET JUPYTER_TOKEN=%%A
  ECHO JUPYTER_TOKEN=!JUPYTER_TOKEN!>> .\apps\api\.env

  ECHO OPENAI_API_KEY=sk-placeholder>> .\apps\api\.env

  ECHO Generated a new .\apps\api\.env file with default values
)

REM If the .env file does not exist in WEB, create one
IF NOT EXIST .\apps\web\.env (
  ECHO NODE_ENV=development> .\apps\web\.env
  ECHO NEXT_PUBLIC_API_URL='https://localhost:8080'>> .\apps\web\.env
  ECHO NEXT_PUBLIC_API_WS_URL='wss://localhost:8080'>> .\apps\web\.env
  ECHO NEXT_PUBLIC_PUBLIC_URL='https://localhost:3000'>> .\apps\web\.env

  ECHO Generated a new .\apps\web\.env file with default values
)

REM Read JUPYTER_TOKEN from apps\api\.env and remove single and double quotes
FOR /F "tokens=1,2 delims==" %%A IN ('findstr JUPYTER_TOKEN .\apps\api\.env') DO SET JUPYTER_TOKEN=%%B
SET JUPYTER_TOKEN=%JUPYTER_TOKEN:'=%
SET JUPYTER_TOKEN=%JUPYTER_TOKEN:"=%

REM Verify if Docker Compose exists
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

REM Run docker compose up with JUPYTER_TOKEN from environment
ECHO Using %COMPOSE_CMD% to start the services...
SET JUPYTER_TOKEN=%JUPYTER_TOKEN%
%COMPOSE_CMD% -f docker-compose.dev.yaml up