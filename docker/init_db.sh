#!/bin/bash

# Wait for PostgreSQL to start
until psql -U postgres -c "SELECT 1" &>/dev/null; do
  echo "Waiting for PostgreSQL to start..."
  sleep 1
done


if [ ! -f /var/lib/postgresql/data/.init ]; then
  psql -U postgres -c "CREATE USER briefer WITH PASSWORD 'briefer';"
  psql -U postgres -c "CREATE DATABASE briefer OWNER briefer;"
  psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE briefer TO briefer;"
  touch /var/lib/postgresql/data/.init
fi

psql -U postgres -d briefer -c "CREATE EXTENSION IF NOT EXISTS vector;"
