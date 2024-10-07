KUBECONFIG := ${HOME}/.kube/config
ARCH := $(shell uname -m | tr A-Z a-z)
OS := $(shell uname -s | tr A-Z a-z)

HELM := bin/helm
HELM_VERSION := 3.12.2
K3D := bin/k3d
K3D_VERSION := 5.7.4

# Stands up a local K3D cluster and deploys the chart there.
install: up
	@kubectl get ns | grep briefer >/dev/null || kubectl create ns briefer
	@kubectl get secret | grep briefer >/dev/null || kubectl create secret generic briefer -n briefer \
		--from-literal=AI_PASSWORD="$(shell openssl rand -hex 12)" \
		--from-literal=AUTH_JWT_SECRET="$(shell openssl rand -hex 24)" \
		--from-literal=DATASOURCES_ENCRYPTION_KEY="$(shell openssl rand -hex 32)" \
		--from-literal=ENVIRONMENT_VARIABLES_ENCRYPTION_KEY="$(shell openssl rand -hex 32)" \
		--from-literal=JUPYTER_TOKEN="$(shell openssl rand -hex 24)" \
		--from-literal=LOGIN_JWT_SECRET="$(shell openssl rand -hex 24)" \
		--from-literal=OPENAI_API_KEY="sk-placeholder" \
		--from-literal=POSTGRES_PASSWORD="testPassword" \
		--from-literal=POSTGRES_PRISMA_URL="postgresql://briefer:testPassword@briefer-postgres:5432/briefer?schema=public" \
		--from-literal=WORKSPACE_SECRETS_ENCRYPTION_KEY="$(shell openssl rand -hex 32)"
	@$(HELM) upgrade briefer --install . -n briefer -f values.yaml -f values.local.yaml

# Renders this chart to stdout using the values in values.local.yaml
template: $(HELM)
	@$(HELM) template briefer . -f values.local.yaml

# Starts up a new K3D cluster and updates the context.
up: $(K3D)
	@if ! $(K3D) cluster get briefer >/dev/null; then \
		$(K3D) cluster create --config k3d.yaml; \
	fi

# Shuts down the K3D cluster and removes kubeconfig context.
down: $(K3D)
	@$(K3D) cluster delete --config k3d.yaml

# Install Helm binary in the bin/ dir.
#
# Run `rm bin/helm && make bin/helm` to reinstall after changing the version.
$(HELM):
	@echo Installing helm to $(HELM)...
	@mkdir -p bin/
	@mkdir -p bin/helm_tmp
	@curl -fsSL -o bin/helm_tmp/helm.tar.gz https://get.helm.sh/helm-v$(HELM_VERSION)-$(OS)-$(ARCH).tar.gz
	@tar -xzf bin/helm_tmp/helm.tar.gz -C bin/helm_tmp
	@mv bin/helm_tmp/$(OS)-$(ARCH)/helm bin/
	@rm -rf bin/helm_tmp # Would be better with a trap.

# Install K3d binary in the bin/ dir.
#
# Run `rm bin/k3d && make bin/k3d` to reinstall after changing the version.
$(K3D):
	@echo Installing k3d to $(K3D)...
	@mkdir -p bin/
	@curl -fsSL -o $(K3D) https://github.com/k3d-io/k3d/releases/download/v$(K3D_VERSION)/k3d-$(OS)-$(ARCH)
	@chmod +x $(K3D)
