FROM postgres:16

# Install pgvector
RUN apt-get update && apt-get install -y postgresql-16-pgvector

# Clean up
RUN apt-get clean && rm -rf /var/lib/apt/lists/*
