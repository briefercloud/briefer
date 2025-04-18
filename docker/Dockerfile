FROM node:18-slim AS base

RUN apt-get update && apt-get install -y \
    python3.10 \
    python3-pip \
    python3-venv \
    python3-dev \
    postgresql \
    postgresql-common \
    postgresql-contrib \
    nginx \
    sudo \
    xz-utils \
    libpq-dev \
    r-base \
    graphviz \
    libgraphviz-dev \
    default-libmysqlclient-dev \
    build-essential \
    pkg-config \
    jq \
    git \
    gdal-bin \
    libgdal-dev \
    curl \
    supervisor \
    libaio1 \
    gcc \
    alien && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Set environment variable to skip the user prompt
ENV DEBIAN_FRONTEND=noninteractive
# Enable the PostgreSQL APT repository
RUN /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
# Install the pgvector extension for PostgreSQL
RUN apt-get update && apt-get install -y postgresql-15-pgvector && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

#### ORACLE INSTANT CLIENT ####
ARG TARGETARCH

RUN if [ "$TARGETARCH" = "arm64" ]; then \
        # Download Oracle Instant Client RPM, convert to DEB, and install
        curl -o /tmp/oracle-instantclient-basiclite.rpm https://download.oracle.com/otn_software/linux/instantclient/1924000/oracle-instantclient19.24-basiclite-19.24.0.0.0-1.aarch64.rpm && \
        alien -i /tmp/oracle-instantclient-basiclite.rpm && \
        rm /tmp/oracle-instantclient-basiclite.rpm; \
    elif [ "$TARGETARCH" = "amd64" ]; then \
        curl -o /tmp/oracle-instantclient-basiclite.rpm https://download.oracle.com/otn_software/linux/instantclient/2340000/oracle-instantclient-basic-23.4.0.24.05-1.el8.x86_64.rpm && \
        alien -i /tmp/oracle-instantclient-basiclite.rpm && \
        rm /tmp/oracle-instantclient-basiclite.rpm; \
    else \
        echo "Unsupported architecture: $TARGETARCH"; \
        exit 1; \
    fi

# Set environment variables for Oracle Instant Client
ENV LD_LIBRARY_PATH="/usr/lib/oracle/19.24/client64/lib:/usr/lib/oracle/23.4/client64/lib:${LD_LIBRARY_PATH}"
ENV ORACLE_HOME="/usr/lib/oracle/19.24/client64:/usr/lib/oracle/23.4/client64"
#### END OF ORACLE INSTANT CLIENT ####

ENV TURBO_TELEMETRY_DISABLED=1

##### START OF API BUILD #####
FROM base AS api-builder

WORKDIR /app
RUN yarn global add turbo
COPY . .
RUN turbo prune @briefer/api --docker

FROM base AS api-installer

WORKDIR /app

# First install dependencies (as they change less often)
COPY .gitignore .gitignore
COPY --from=api-builder /app/out/json/ .
COPY --from=api-builder /app/out/yarn.lock ./yarn.lock
RUN yarn install --network-timeout 1000000
RUN yarn install

# Build the project and its dependencies
COPY --from=api-builder /app/out/full/ .
COPY turbo.json turbo.json
RUN yarn turbo run build --filter=@briefer/api...
##### END OF API BUILD #####

##### START OF WEB BUILD #####
FROM base AS web-builder
WORKDIR /app
RUN yarn global add turbo
COPY . .
RUN turbo prune @briefer/web --docker

FROM base AS web-installer
WORKDIR /app

# First install the dependencies (as they change less often)
COPY .gitignore .gitignore
COPY --from=web-builder /app/out/json/ .
COPY --from=web-builder /app/out/yarn.lock ./yarn.lock
RUN yarn install --network-timeout 1000000
RUN yarn install --frozen-lockfile

# Build the project
COPY --from=web-builder /app/out/full/ .
COPY turbo.json turbo.json

ENV NEXT_PUBLIC_SINGLE_PROCESS=true

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

ARG NEXT_PUBLIC_API_WS_URL
ENV NEXT_PUBLIC_API_WS_URL=$NEXT_PUBLIC_API_WS_URL

ARG NEXT_PUBLIC_PUBLIC_URL
ENV NEXT_PUBLIC_PUBLIC_URL=$NEXT_PUBLIC_PUBLIC_URL

RUN yarn next telemetry disable
RUN yarn turbo run build --filter=@briefer/web...
##### END OF WEB BUILD #####

FROM base AS runner

##### START OF JUPYTER BUILD #####
WORKDIR /app/jupyter
ARG JUPYTER_REQUIREMENTS_FILE=apps/api/jupyter-requirements.txt
COPY $JUPYTER_REQUIREMENTS_FILE ./requirements.txt

# Set the GDAL version
ENV CPLUS_INCLUDE_PATH=/usr/include/gdal
ENV C_INCLUDE_PATH=/usr/include/gdal

# Create a virtual environment and install Python packages inside it
RUN python3 -m venv /app/jupyter/venv
RUN /app/jupyter/venv/bin/pip install --upgrade pip
RUN /app/jupyter/venv/bin/pip install --no-cache-dir jupyter_server
RUN /app/jupyter/venv/bin/pip install --no-cache-dir ipykernel
RUN /app/jupyter/venv/bin/pip install --no-cache-dir -r requirements.txt

# jupyter extension
COPY apps/api/jupyter_briefer_extension /usr/src/jupyter_briefer_extension
RUN /app/jupyter/venv/bin/pip install /usr/src/jupyter_briefer_extension
RUN /app/jupyter/venv/bin/jupyter server extension enable jupyter_briefer_extension --sys-prefix
##### END OF JUPYTER BUILD #####

### START OF AI SERVICE BUILD ###
WORKDIR /app/ai

COPY ai/. .

RUN python3 -m venv /app/ai/venv
RUN /app/ai/venv/bin/pip install --upgrade pip
RUN /app/ai/venv/bin/pip install --no-cache-dir -r requirements.txt
### END OF AI SERVICE BUILD ###

WORKDIR /app

RUN groupadd -r briefer \
    && useradd -r -g briefer briefer \
    && mkdir -p /home/briefer \
    && mkdir -p /home/briefer/.config/briefer \
    && chown -R briefer:briefer /home/briefer \
    && chmod 700 /home/briefer \ 
    && groupadd -r jupyteruser \
    && useradd -r -g jupyteruser jupyteruser \
    && mkdir -p /home/jupyteruser \
    && chown -R jupyteruser:jupyteruser /home/jupyteruser \
    && chown -R jupyteruser:jupyteruser /app/jupyter/venv \
    && chmod 700 /home/jupyteruser

#### START OF COPY API AND WEB BUILDS ####
WORKDIR /app/api
COPY --from=api-installer --chown=briefer:briefer /app .

WORKDIR /app/web
COPY --from=web-installer --chown=briefer:briefer /app/apps/web/next.config.js .
COPY --from=web-installer --chown=briefer:briefer /app/apps/web/package.json .
COPY --from=web-installer --chown=briefer:briefer /app/apps/web/.next/standalone ./
COPY --from=web-installer --chown=briefer:briefer /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=web-installer --chown=briefer:briefer /app/apps/web/public ./apps/web/public
COPY --from=web-installer --chown=briefer:briefer /app/apps/web/start.sh ./apps/web/start.sh
##### END OF COPY API AND WEB BUILDS ####

# NGINX
RUN mkdir -p /var/log/nginx /etc/nginx /etc/nginx/conf.d
COPY ./nginx/nginx.conf /etc/nginx/nginx.conf
COPY ./docker/start-nginx.sh /app/start-nginx.sh
RUN chmod +x /app/start-nginx.sh


USER postgres
RUN mkdir -p /var/lib/postgresql/data \
    && chown -R postgres:postgres /var/lib/postgresql \
    && /usr/lib/postgresql/15/bin/initdb -D /var/lib/postgresql/data

USER briefer
WORKDIR /app/setup
RUN python3 -m venv /app/setup/venv
RUN /app/setup/venv/bin/pip install --upgrade pip
COPY docker/setup/requirements.txt requirements.txt
RUN /app/setup/venv/bin/pip install -r requirements.txt
COPY docker/setup/* .

USER root
RUN mkdir -p /var/log/supervisor
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

COPY docker/init_db.sh /usr/local/bin/init_db.sh
RUN chmod +x /usr/local/bin/init_db.sh

CMD ["supervisord", "-c", "/etc/supervisor/supervisord.conf"]
