import time
import subprocess
from pathlib import Path
import logging
import os

CONFIG_DIR = Path(Path.home(), ".config", "briefer")
SETUP_FILE_PATH = Path(CONFIG_DIR, "setup")

def wait_setup():
    while SETUP_FILE_PATH.exists():
        logging.info("Waiting for setup to finish")
        time.sleep(0.3)


def run_web():
    logging.info("Running Web")

    default_env = {
        "NODE_ENV": "production",
    }
    env = os.environ.copy()
    for k, v in default_env.items():
        if k not in env:
            env[k] = v

    web = subprocess.run(["/app/web/apps/web/start.sh"], env=env)
    web.check_returncode()


def main():
    wait_setup()
    run_web()


if __name__ == '__main__':
    main()

