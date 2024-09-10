import time
import subprocess
from pathlib import Path
import json
import logging
import os

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


def run_web(cfg):
    logging.info("Running Web")

    default_env = {
        "NODE_ENV": "production",
        "NEXT_PUBLIC_API_URL": cfg["API_URL"],
        "NEXT_PUBLIC_API_WS_URL": cfg["API_URL"].replace('http', 'ws'),
        "NEXT_PUBLIC_PUBLIC_URL": cfg["FRONTEND_URL"],
    }
    env = os.environ.copy()
    for k, v in default_env.items():
        if k not in env:
            env[k] = v

    web = subprocess.run(["/app/web/apps/web/start.sh"], env=env)
    web.check_returncode()


def main():
    wait_setup()
    cfg = get_config()
    run_web(cfg)


if __name__ == '__main__':
    main()

