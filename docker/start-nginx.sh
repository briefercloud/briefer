#!/bin/bash

# Function to ensure web and api are in /etc/hosts
update_hosts() {
    if ! grep -q "127.0.0.1 web" /etc/hosts; then
        echo "127.0.0.1 web" >> /etc/hosts
    fi
    if ! grep -q "127.0.0.1 api" /etc/hosts; then
        echo "127.0.0.1 api" >> /etc/hosts
    fi
}

# Loop until both web and api services are reachable
while true; do
    update_hosts

    # Check if the web and api services are reachable
    if curl --output /dev/null --silent --head --fail http://web:4000 && curl --output /dev/null --silent --head --fail http://api:8080/readyz; then
        echo "Web and API services are reachable, starting Nginx..."
        break
    else
        echo "Waiting for Web and API services to be reachable..."
        sleep 2
    fi
done

# Start Nginx
nginx -g 'daemon off;'
