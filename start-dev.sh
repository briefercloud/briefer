#!/bin/bash
set -e

# if there is no .env file in API, create one
if [ ! -f ./apps/api/.env ]; then
  echo "NODE_ENV=development" > ./apps/api/.env
  echo "LOG_LEVEL=debug" >> ./apps/api/.env
  echo "API_URL='http://localhost:8080'" >> ./apps/api/.env
  echo "FRONTEND_URL='http://localhost:4000'" >> ./apps/api/.env
  echo "TLD=localhost" >> ./apps/api/.env
  echo "LOGIN_JWT_SECRET=$(openssl rand -hex 24)" >> ./apps/api/.env
  echo "AUTH_JWT_SECRET=$(openssl rand -hex 24)" >> ./apps/api/.env
  echo "AI_API_URL='http://localhost:8000'" >> ./apps/api/.env
  echo "AI_API_USERNAME=$(openssl rand -hex 12)" >> ./apps/api/.env
  echo "AI_API_PASSWORD=$(openssl rand -hex 12)" >> ./apps/api/.env
  echo "PYTHON_ALLOWED_LIBRARIES='plotly,matplotlib,numpy,pandas'" >> ./apps/api/.env
  echo "POSTGRES_USERNAME=postgres" >> ./apps/api/.env
  echo "POSTGRES_PASSWORD=password" >> ./apps/api/.env
  echo "POSTGRES_HOSTNAME=localhost" >> ./apps/api/.env
  echo "POSTGRES_PORT=5432" >> ./apps/api/.env

  echo "POSTGRES_DATABASE=briefer" >> ./apps/api/.env
  echo "ENVIRONMENT_VARIABLES_ENCRYPTION_KEY=$(openssl rand -hex 32)" >> ./apps/api/.env
  echo "DATASOURCES_ENCRYPTION_KEY=$(openssl rand -hex 32)" >> ./apps/api/.env
  echo "WORKSPACE_SECRETS_ENCRYPTION_KEY=$(openssl rand -hex 32)" >> ./apps/api/.env
  echo "JUPYTER_HOST=localhost" >> ./apps/api/.env
  echo "JUPYTER_PORT=8888" >> ./apps/api/.env
  echo "JUPYTER_TOKEN=$(openssl rand -hex 24)" >> ./apps/api/.env
  echo "OPENAI_API_KEY=sk-placeholder" >> ./apps/api/.env

  echo "Generated a new ./apps/api/.env file with default values"
fi

# if there is no .env file in WEB, create one
if [ ! -f ./apps/web/.env ]; then
  echo "NODE_ENV=development" > ./apps/web/.env
  echo "NEXT_PUBLIC_API_URL='http://localhost:8080'" >> ./apps/web/.env
  echo "NEXT_PUBLIC_API_WS_URL='ws://localhost:8080'" >> ./apps/web/.env
  echo "NEXT_PUBLIC_PUBLIC_URL='http://localhost:4000'" >> ./apps/web/.env

  echo "Generated a new ./apps/eb/.env file with default values"
fi

# Read JUPYTER_TOKEN from apps/api/.env, remove single and double quotes
JUPYTER_TOKEN=$(grep JUPYTER_TOKEN ./apps/api/.env | cut -d '=' -f 2 | tr -d "'" | tr -d '"')

# Check if docker compose exists, if it does use it
# otherwise use docker-compose
if command -v docker compose > /dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose > /dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
else
  echo "Neither docker compose nor docker-compose is installed, exiting..."
  exit 1
fi

# Running docker compose up with JUPYTER_TOKEN from the environment
echo "Using $COMPOSE_CMD to start the services..."
JUPYTER_TOKEN=$JUPYTER_TOKEN $COMPOSE_CMD -f docker-compose.dev.yaml up
