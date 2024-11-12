# Use an official MySQL runtime as a parent image
FROM mysql:latest

# Set environment variables
ENV MYSQL_ROOT_PASSWORD=root
ENV MYSQL_DATABASE=mydatabase
ENV MYSQL_USER=user
ENV MYSQL_PASSWORD=password

# Copy SQL scripts into the Docker container
COPY ./1_schema.sql /docker-entrypoint-initdb.d/
COPY ./2_seed.sql /docker-entrypoint-initdb.d/

# Expose MySQL default port
EXPOSE 3306

# Run MySQL daemon
CMD ["mysqld"]
