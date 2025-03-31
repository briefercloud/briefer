import subprocess
from pathlib import Path
import os
import json
import time
import logging

CONFIG_DIR = Path(Path.home(), ".config", "briefer")
CONFIG_FILE_PATH = Path(CONFIG_DIR, "briefer.json")
SETUP_FILE_PATH = Path(CONFIG_DIR, "setup")

def wait_setup():
    while SETUP_FILE_PATH.exists():
        logging.info("Waiting for setup to finish")
        time.sleep(0.3)

def get_config():
    while not CONFIG_FILE_PATH.exists():
        logging.info("Waiting for config file")
        time.sleep(0.3)

    logging.info("Reading config file")
    with open(CONFIG_FILE_PATH, "r") as f:
        cfg = json.load(f)

        # override config with env vars
        for k, _ in cfg.items():
            if k in os.environ:
                cfg[k] = os.environ[k]

        return cfg

def run_api(cfg):
    logging.info("Running API")
    default_env = {
      "NODE_ENV": "production",
      "LOG_LEVEL": "info",
      "API_URL": "/api",
      "FRONTEND_URL": "/",
      "LOGIN_JWT_SECRET": cfg["LOGIN_JWT_SECRET"],
      "AUTH_JWT_SECRET": cfg["AUTH_JWT_SECRET"],
      "AI_API_URL": "http://localhost:8000",
      "AI_API_USERNAME": cfg["AI_BASIC_AUTH_USERNAME"],
      "AI_API_PASSWORD": cfg["AI_BASIC_AUTH_PASSWORD"],
      "PYTHON_ALLOWED_LIBRARIES": "plotly,matplotlib,numpy,pandas",
      "POSTGRES_USERNAME": cfg["POSTGRES_USERNAME"],
      "POSTGRES_PASSWORD": cfg["POSTGRES_PASSWORD"],
      "POSTGRES_HOSTNAME": cfg.get("POSTGRES_HOSTNAME", "localhost"),
      "POSTGRES_PORT": "5432",
      "POSTGRES_DATABASE": "briefer",
      "ENVIRONMENT_VARIABLES_ENCRYPTION_KEY": cfg["ENVIRONMENT_VARIABLES_ENCRYPTION_KEY"],
      "WORKSPACE_SECRETS_ENCRYPTION_KEY": cfg["WORKSPACE_SECRETS_ENCRYPTION_KEY"],
      "DATASOURCES_ENCRYPTION_KEY": cfg["DATASOURCES_ENCRYPTION_KEY"],
      "JUPYTER_HOST": "localhost",
      "JUPYTER_PORT": "8888",
      "JUPYTER_TOKEN": cfg["JUPYTER_TOKEN"]
    }
    env = os.environ.copy()
    for k, v in default_env.items():
        if k not in env:
            env[k] = v

    with open("/app/api/apps/api/package.json", "r") as f:
        pkgjson = json.load(f)
        env["VERSION"] = pkgjson["version"]

    api = subprocess.run(["bash", "-c", "node /app/api/apps/api/dist/src/index.js | /app/api/node_modules/.bin/pino-pretty"], env=env)
    api.check_returncode()


def main():
    logging.basicConfig(level=logging.INFO)

    wait_setup()
    cfg = get_config()
    run_api(cfg)

if __name__ == '__main__':
    main()

