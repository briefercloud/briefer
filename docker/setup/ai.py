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

def run_ai(cfg):
    logging.info("Running API")
    default_env = {
      "BASIC_AUTH_USERNAME": cfg["AI_BASIC_AUTH_USERNAME"],
      "BASIC_AUTH_PASSWORD": cfg["AI_BASIC_AUTH_PASSWORD"],
      "PORT": "8000"
    }
    env = os.environ.copy()
    for k, v in default_env.items():
        if k not in env:
            env[k] = v

    ai = subprocess.run(["bash", "-c", "/app/ai/venv/bin/uvicorn api.app:app --host 0.0.0.0 --port ${PORT}"], env=env, cwd="/app/ai")
    ai.check_returncode()


def main():
    logging.basicConfig(level=logging.INFO)

    wait_setup()
    cfg = get_config()
    run_ai(cfg)

if __name__ == '__main__':
    main()

