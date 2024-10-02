# Recommendations for deploying Briefer on GCP

This document describes how to set up Briefer on a Google Cloud Platform (GCP) instance using Compute Engine, Docker, and, optionally, Nginx as a reverse proxy for public access.

Note that these are recommendations from October 2024 and may be subject to change due to updates in GCP. If you encounter any issues, please feel free to update this document.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Creating the Compute Engine Instance](#creating-the-compute-engine-instance)
3. [Installing Docker](#installing-docker)
4. [Running Briefer](#running-briefer)
5. [(Optional) Configuring Nginx for Public Access](#optional-configuring-nginx-for-public-access)
6. [Conclusion](#conclusion)

## Prerequisites

- Google Cloud Platform (GCP) account
- Access to Google Cloud Console
- SSH key configured to access the GCP instance

## Creating the Compute Engine Instance

1. Access the [Google Cloud Console](https://console.cloud.google.com/) and navigate to Compute Engine > VM instances.
2. Click on "Create Instance."
3. We recommend configuring the VM with these settings (or higher):
   - **vCPUs**: 2
   - **Memory**: 8 GB
   - **Disk**: 10 GB balanced
   - **IOPS**: 3060 provisioned
   - **Processing capacity**: 155 provisioned
4. Give your instance a name and click "Create."

| These requirements are ideal for most cases. However, they can be adjusted up or down depending on your project's needs and demands.

Once the instance is initialized, connect to it via SSH.

## Installing Docker

1. Update the instance's packages:
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```
2. Install the necessary packages for HTTPS repositories:
   ```bash
   sudo apt install apt-transport-https ca-certificates curl software-properties-common
   ```
3. Add the Docker repository:
   ```bash
   curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
   sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu focal stable"
   sudo apt update
   ```
4. Install Docker:
   ```bash
   sudo apt install docker-ce -y
   ```
5. Add your user to the `docker` group:
   ```bash
   sudo usermod -aG docker ${USER}
   ```
6. Verify if Docker was installed correctly:

   ```bash
   docker ps
   ```

## Running Briefer

After installing Docker, you can run Briefer using the following command:

```bash
docker run -d \
  -p 3000:3000
  -v briefer_psql_data:/var/lib/postgresql/data \
  -v briefer_jupyter_data:/home/jupyteruser \
  -v briefer_briefer_data:/home/briefer \
  briefercloud/briefer
```

Verify that Briefer is running by accessing port `3000` on your instance's public IP:

```bash
curl http://<your_public_ip>:3000
```

The Briefer interface should be accessible directly from the browser using the same URL.

> [!NOTE]
> Please note that you should not be able to login yet because you're serving Briefer over HTTP and have not set the `ALLOW_HTTP` environment variable to `true`. If you want to continue using Briefer over HTTP please add `--env ALLOW_HTTP=true` to the `docker run` command. If you want to use HTTPS, please set up SSL certificates.

---

## (Optional) Configuring Nginx for Public Access

To expose Briefer through a reverse proxy using Nginx:

1. Install Nginx:

   ```bash
   sudo apt install nginx -y
   sudo systemctl start nginx
   sudo systemctl enable nginx
   ```

2. Verify that Nginx is running by accessing the public IP of the instance in your browser.

3. Configure Nginx to serve Briefer:

   ```bash
   cd /etc/nginx/sites-available/
   sudo nano /etc/nginx/sites-available/briefer
   ```

   Add the following content to the file:

   ```nginx
   server {
       listen 80;

       server_name _;

       client_max_body_size 0;

       location / {
           proxy_pass http://localhost:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_request_buffering off;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "Upgrade";
       }
   }
   ```

4. Enable the new configuration:

   ```bash
   sudo ln -s /etc/nginx/sites-available/briefer /etc/nginx/sites-enabled/
   sudo rm /etc/nginx/sites-enabled/default
   sudo nginx -t
   sudo systemctl restart nginx
   ```

Now, Briefer will be accessible through your instance's public IP without needing to specify port 3000.
