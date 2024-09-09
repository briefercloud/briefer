import time
import subprocess
from pathlib import Path
import os
import json
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
        return json.load(f)


def run_jupyter(cfg):
    env = os.environ.copy()
    env["JUPYTER_TOKEN"] = cfg["JUPYTER_TOKEN"]

    jupyter = subprocess.run([
        "/app/jupyter/venv/bin/jupyter",
        "server",
        "--ip=0.0.0.0",
        "--ZMQChannelsWebsocketConnection.iopub_data_rate_limit=1.0e10",
        "--ZMQChannelsWebsocketConnection.iopub_msg_rate_limit=1.0e6",
        "--ServerApp.max_body_size=107374182400"
    ], env=env, cwd="/home/jupyteruser")

    jupyter.check_returncode()


def main():
    logging.basicConfig(level=logging.INFO)

    wait_setup()
    cfg = get_config()
    run_jupyter(cfg)


if __name__ == '__main__':
    main()

