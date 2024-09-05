import time
import subprocess
from pathlib import Path
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


def run_web(cfg):
    logging.info("Running Web")
    web = subprocess.run(["node", "/app/web/apps/web/server.js"])
    web.check_returncode()


def main():
    wait_setup()
    cfg = get_config()
    run_web(cfg)


if __name__ == '__main__':
    main()

