#!/bin/bash
set -e

if [ ! -f ./apps/api/.env ]; then
  echo "Error: Environment file not found at ./apps/api/.env"
  exit 1
fi

# We must load the environment variables from the .env file so that
# we have JUPYTER_TOKEN available to pass to the docker-compose command
# and so that it will be the same as the one used in the API
source ./apps/api/.env

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
