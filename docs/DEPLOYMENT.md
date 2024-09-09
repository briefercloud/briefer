# Briefer's Deployment Guide

In this document we'll cover the most important aspects of deploying Briefer to a production environment.

<br />

## Introduction

Briefer is a web application designed for multiple people to use.

Ideally, you should deploy it to a server that is accessible to all the people who will view and create reports and dashboards, like an EC2 instance on AWS, a droplet on DigitalOcean, or a virtual machine on Azure.

<br />
<p>
<picture align="center">
  <source  align="center" media="(prefers-color-scheme: dark)" srcset="./assets/img/briefer-usage-overview-dark.png">
  <source align="center" media="(prefers-color-scheme: light)" srcset="./assets/img/briefer-usage-overview.png">
  <img align="center" alt="Briefer usage diagram" src="./assets/img/briefer-usage-overview.png">
</picture>
</p>
<br />

Briefer deployments have the following components:

- A web application that users will access in their browsers.
- An API that the web application will talk to.
- A database to store the data that users upload.
- A Jupyter server that runs the actual code.
- An optional AI service that runs the AI features like code generation and automatic fixes.

After deploying Briefer, you'll access the web application in your browser and it'll talk to the API. In turn, the API will talk to the database and the Jupyter server, which are not exposed.

<br />
<p>
<picture align="center">
  <source  align="center" media="(prefers-color-scheme: dark)" srcset="./assets/img/deployment-overview-dark.png">
  <source align="center" media="(prefers-color-scheme: light)" srcset="./assets/img/deployment-overview.png">
  <img align="center" alt="Briefer usage diagram" src="./assets/img/deployment-overview.png">
</picture>
</p>
<br />

In this guide, we'll cover the three recommended ways to deploy Briefer:

1. Deploy Briefer as a single container on an remote server.
2. Deploy Briefer as a multiple containers on an remote server.
3. Deploy Briefer into Kubernetes.

If you're not sure which option to choose, we recommend starting with the first one.

<br />

### Alternative 1: Deploying briefer as a single container on an remote server

This is the simplest way to deploy Briefer. You'll only need to install Docker on your server and run a single command to start the application.

Then, you'll have to make sure that this server is accessible to all the people who will use Briefer, and use the necessary DNS records to access the web application and the API.

Here's a step-by-step guide to deploy Briefer as a single container:

1. Get a machine and SSH into it.
2. Install Docker on the machine.
   ```bash
   # On an EC2 instance, for example
   sudo yum update -y
   sudo yum install docker -y
   sudo systemctl start docker
   ```
3. Pull and run the all-in-one Docker image for Briefer.
   ```bash
    docker run -d \
      -p 3000:3000 \
      -p 8080:8080 \
      -v briefer_psql_data:/var/lib/postgresql/data \
      -v briefer_jupyter_data:/home/jupyteruser \
      -v briefer_briefer_data:/home/briefer \
      --env TLD="briefer.your_domain_here.com" \
      briefercloud/briefer
   ```
4. Expose your server to the internet or your local network.
   Make sure that you allow traffic on ports 3000 and 8080. The first one is for the Briefer web application (the one you'll access in your browser), and the second one is for the API that the web application talks to.
5. Create the necessary DNS records to access ports 3000 and 8080.
   Use `app.briefer.your_domain_here.com` as the name for the web application bound to port 3000, and `api.briefer.your_domain_here.com` as the name for the API bound to port 8080.

Now you should be able to access the Briefer web application at `app.briefer.your_domain_here.com` and the API at `api.briefer.your_domain_here.com`.

<br />

### Alternative 2: Deploying Briefer as multiple containers on an remote server

Besides deploying Briefer as a single container, you can also deploy it as multiple containers. That way, you'll have separate containers for the web application, the API, the AI service, the database, and the Jupyter notebook server.

This approach is more complex than the previous one, but it allows you to use configure each container separately.

That way, you can scale each part of the application independently or just change the configuration of one part without affecting the others. If you want to use an RDS instance for the database, for example, you can do that by changing the configuration of the database container.

Here's a step-by-step guide to deploy Briefer as multiple containers:

1. Get a machine and SSH into it.
2. Install Docker on the machine.
   ```bash
   # On an EC2 instance, for example
   sudo yum update -y
   sudo yum install docker -y
   sudo systemctl start docker
   ```
3. Run the `start.sh` script and enter Briefer's TLD to start all the containers.
   We recommend using `briefer.your_domain_here.com` as the TLD.
   ```bash
   ./start.sh
   ```
4. Expose your server to the internet or your local network.
   Make sure that you allow traffic on ports 3000 and 8080. The first one is for the Briefer web application (the one you'll access in your browser), and the second one is for the API that the web application talks to.
5. Create the necessary DNS records to access ports 3000 and 8080.
   Use `app.briefer.your_domain_here.com` as the name for the web application bound to port 3000, and `api.briefer.your_domain_here.com` as the name for the API bound to port 8080.

If you want to use an RDS instance for the database, you will need to:

1. Comment-out the `postgres` service in the `docker-compose.yml` file.
2. Change the `POSTGRES_PRISMA_URL` environment variable in the `db_migration` service to point to your RDS instance.
3. Change these variables in the `api` service:
   - `POSTGRES_USERNAME`: username for logging into the RDS database.
   - `POSTGRES_PASSWORD`: password for logging into the RDS database.
   - `POSTGRES_HOSTNAME`: hostname of the RDS instance.
   - `POSTGRES_PORT`: port of the RDS instance.
   - `POSTGRES_DATABASE`: name of the RDS database.

<br />

### Alternative 3: Deploying Briefer into Kubernetes

If you're already using Kubernetes, you can deploy Briefer into your cluster. This approach is more complex than the previous ones, but it allows you to keep Briefer in the same place as the rest of your applications.

We haven't yet published Kubernetes manifests for Briefer, but you can use the `docker-compose.yml` file as a starting point to create your own manifests.

If you're interested in contributing to Briefer, we'd love to have your help in creating Kubernetes manifests for the project.
