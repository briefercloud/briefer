#!/bin/bash
set -e

# if there is no .env file, create one
if [ ! -f .env ]; then
  echo "POSTGRES_USERNAME=$(openssl rand -hex 12)" >> .env
  echo "POSTGRES_PASSWORD=$(openssl rand -hex 12)" >> .env
  echo "JUPYTER_TOKEN=$(openssl rand -hex 24)" >> .env
  echo "AI_BASIC_AUTH_USERNAME=$(openssl rand -hex 12)" >> .env
  echo "AI_BASIC_AUTH_PASSWORD=$(openssl rand -hex 12)" >> .env
  echo "OPENAI_API_KEY=sk-placeholder" >> .env
  echo "LOGIN_JWT_SECRET=$(openssl rand -hex 24)" >> .env
  echo "AUTH_JWT_SECRET=$(openssl rand -hex 24)" >> .env
  echo "ENVIRONMENT_VARIABLES_ENCRYPTION_KEY=$(openssl rand -hex 32)" >> .env
  echo "WORKSPACE_SECRETS_ENCRYPTION_KEY=$(openssl rand -hex 32)" >> .env
  echo "DATASOURCES_ENCRYPTION_KEY=$(openssl rand -hex 32)" >> .env
fi

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

# Running docker compose up
$COMPOSE_CMD up -d
echo "Briefer is now running at port 3000"
