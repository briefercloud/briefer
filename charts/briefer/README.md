# briefer

A chart for installing Briefer and all of it's components.

![Version: 0.1.0](https://img.shields.io/badge/Version-0.1.0-informational?style=flat-square) ![AppVersion: 0.0.26](https://img.shields.io/badge/AppVersion-0.0.26-informational?style=flat-square)

This repository contains a Helm chart which can be used to deploy Briefer to your Kubernetes cluster.

## Prerequisites

You'll need a few things in place before installing the Chart. In particular, you'll need:

* A running postgres server with access credentials to be used by Briefer.
* A Kubernetes namespace to deploy to.
* A secret named `briefer` deployed in that namespace.
* A values file with appropriate settings for your deployment

### Creating the Secret

```bash
# Create the namespace on your K8s cluster.
kubectl create ns <YOUR_NAMESPACE>

# Create the secret.
# See https://kubernetes.io/docs/concepts/configuration/secret/#creating-a-secret for alternatives.
kubectl create secret generic briefer -n <YOUR_NAMESPACE> \
  --from-literal=AI_PASSWORD=<SECRET_VALUE> \
  --from-literal=AUTH_JWT_SECRET=<SECRET_VALUE> \
  --from-literal=DATASOURCES_ENCRYPTION_KEY=<SECRET_VALUE> \
  --from-literal=ENVIRONMENT_VARIABLES_ENCRYPTION_KEY=<SECRET_VALUE> \
  --from-literal=JUPYTER_TOKEN=<SECRET_VALUE> \
  --from-literal=LOGIN_JWT_SECRET=<SECRET_VALUE> \
  --from-literal=OPENAI_API_KEY=<SECRET_VALUE> \
  --from-literal=POSTGRES_PASSWORD=<SECRET_VALUE> \
  --from-literal=POSTGRES_PRISMA_URL=<SECRET_VALUE> \
  --from-literal=WORKSPACE_SECRETS_ENCRYPTION_KEY=<SECRET_VALUE>
```

> NOTE: You can use a different name for the secret. Just be sure to set `secretName` in your values file accordingly.

**Example**

```bash
kubectl create secret generic briefer -n briefer \
  --from-literal=AI_PASSWORD="$(openssl rand -hex 12)" \
  --from-literal=AUTH_JWT_SECRET="$(openssl rand -hex 24)" \
  --from-literal=DATASOURCES_ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  --from-literal=ENVIRONMENT_VARIABLES_ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  --from-literal=JUPYTER_TOKEN="$(openssl rand -hex 24)" \
  --from-literal=LOGIN_JWT_SECRET="$(openssl rand -hex 24)" \
  --from-literal=OPENAI_API_KEY="sk-placeholder" \
  --from-literal=POSTGRES_PASSWORD="myPostgesPassword" \
  --from-literal=POSTGRES_PRISMA_URL="postgresql://briefer:myPostgesPassword@pghost:5432/briefer?schema=public" \
  --from-literal=WORKSPACE_SECRETS_ENCRYPTION_KEY="$(openssl rand -hex 32)"
```

Values file:

```yaml
api:
  env:
    LOG_LEVEL: info
    POSTGRES_DATABASE: briefer
    POSTGRES_HOSTNAME: pghost
    POSTGRES_PORT: "5432"
    POSTGRES_USERNAME: briefer
    PYTHON_ALLOWED_LIBRARIES: plotly,matplotlib,numpy,pandas
```

## Installing the Chart

For now, this chart isn't published in any repos. You'll need to clone this repo to install it.

To install the chart with the release name `briefer`:

```bash
git clone https://github.com/briefercloud/briefer
cd briefer
helm install briefer chart -f <your_values_file> [--set <key>=<value>,...]
```

## Values

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| ai | object | `{"replicas":1,"resources":null,"user":"briefer","version":""}` | Configuration for the AI service. |
| ai.replicas | int | `1` | The number of replicas to run. |
| ai.resources | string | `nil` | Resource quotas for the containers. See https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/ |
| ai.user | string | `"briefer"` | The basic auth username for the AI service. |
| ai.version | string | `.Values.brieferVersion` | The version of the briefer-ai image to run. |
| api | object | `{"env":{"LOG_LEVEL":"info","PYTHON_ALLOWED_LIBRARIES":"plotly,matplotlib,numpy,pandas"},"replicas":1,"resources":null,"version":""}` | Configuration for the API. |
| api.env | object | `{"LOG_LEVEL":"info","PYTHON_ALLOWED_LIBRARIES":"plotly,matplotlib,numpy,pandas"}` | Environment variables for the API server. |
| api.replicas | int | `1` | The number of replicas to run. |
| api.resources | string | `nil` | Resource quotas for the containers. See https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/ |
| api.version | string | `.Values.brieferVersion` | The version of the briefer-api image to run. |
| brieferVersion | string | `.Chart.AppVersion` | The version of briefer to deploy. This is used for all container images unless an override is specified locally for the service (see `ai`, `api`, `jupyter`, etc. for details). |
| jupyter | object | `{"args":["server","--ip=0.0.0.0","--ZMQChannelsWebsocketConnection.iopub_data_rate_limit=1.0e10","--ZMQChannelsWebsocketConnection.iopub_msg_rate_limit=1.0e6","--ServerApp.max_body_size=107374182400"],"replicas":1,"resources":null,"version":""}` | Configuration for the jupyter service. |
| jupyter.args | list | `["server","--ip=0.0.0.0","--ZMQChannelsWebsocketConnection.iopub_data_rate_limit=1.0e10","--ZMQChannelsWebsocketConnection.iopub_msg_rate_limit=1.0e6","--ServerApp.max_body_size=107374182400"]` | Arguments to be sent to `jupyter`. |
| jupyter.replicas | int | `1` | The number of replicas to run. |
| jupyter.resources | string | `nil` | Resource quotas for the containers. See https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/ |
| jupyter.version | string | `.Values.brieferVersion` | The version of the briefer-jupyter image to run. |
| nginx | object | `{"replicas":1,"resources":null,"version":"1.27"}` | Nginx configuration. |
| nginx.replicas | int | `1` | The number of replicas to run. |
| nginx.resources | string | `nil` | Resource quotas for the containers. See https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/ |
| nginx.version | string | `"1.27"` | The version of nginx to run. |
| postgres | object | `{"create":false,"database":"briefer","diskSize":"10Gi","hostname":null,"port":5432,"resources":null,"storageClassName":null,"username":"briefer","version":"16"}` | Configuration for running PostgreSQL. |
| postgres.create | bool | `false` | When true, deploy the ephemeral PostgreSQL container. |
| postgres.database | string | `"briefer"` | The name of the database |
| postgres.diskSize | string | `"10Gi"` | When create is true, the size of the volume to create. |
| postgres.hostname | string | `nil` | The hostname of the DB server to connect to. |
| postgres.port | int | `5432` | The port to connect on. |
| postgres.resources | string | `nil` | Resource quotas for the containers. See https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/ |
| postgres.storageClassName | string | `nil` | The storageClassName to use for the PVC. If left blank, the Cloud Provider's default storage class will be used. |
| postgres.username | string | `"briefer"` | The username to connect as. |
| postgres.version | string | `"16"` | The version of the postgres container to run. |
| secretName | string | `"briefer"` | The name of the secret used to configure Briefer services. |
| serviceAccount | object | `{"annotations":{},"create":true,"name":""}` | Configuration of the service account used by all pods. |
| serviceAccount.annotations | object | `{}` | Additional annotations to add to the service account. Useful for things like workload identity mappings in GKE. |
| serviceAccount.create | bool | `true` | Whether or not to create the service account. |
| serviceAccount.name | string | The name of the release. | The service account name. |
| web | object | `{"replicas":1,"resources":null,"version":""}` | Configuration for the web (frontend) service. |
| web.replicas | int | `1` | The number of replicas to run. |
| web.resources | string | `nil` | Resource quotas for the containers. See https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/ |
| web.version | string | `.Values.brieferVersion` | The version of the briefer-web image to run. |

## Contributing

The README.md file is auto-generated using [helm-docs]. To update, modify the chart as needed and mention aything
relavent in the README.md.gotmpl file. Then run `helm-docs .` to generate an updated README.md file.

[helm-docs]: https://github.com/norwoodj/helm-docs
