import grp
import pwd
import time
from pathlib import Path
import os
import psycopg2
import json
import subprocess
import logging

APPS_CONFIG_DIR = Path("/home/briefer", ".config", "briefer")
JUPYTER_CONFIG_DIR = Path("/home/jupyteruser", ".config", "briefer")

def get_random_secret(size=32):
    return os.urandom(size).hex()

def get_config_path(dir):
    return Path(dir, "briefer.json")

def get_config(dir):
    fpath = get_config_path(dir)
    with open(fpath, "r") as f:
        return json.load(f)

def generate_apps_config():
    fpath = get_config_path(APPS_CONFIG_DIR)
    tld = os.getenv("TLD", "localhost")
    cfg = {
        "NODE_ENV": "production",
        "LOG_LEVEL": "info",
        "TLD": tld,
        "API_URL": f"https://api.{tld}" if tld != "localhost" else "http://localhost:8080",
        "FRONTEND_URL": f"https://app.{tld}" if tld != "localhost" else "http://localhost:3000",
        "POSTGRES_USERNAME": "briefer",
        "POSTGRES_PASSWORD": get_random_secret(8),
        "JUPYTER_TOKEN": get_random_secret(32),
        "AI_BASIC_AUTH_USERNAME": get_random_secret(8),
        "AI_BASIC_AUTH_PASSWORD": get_random_secret(8),
        "LOGIN_JWT_SECRET": get_random_secret(),
        "AUTH_JWT_SECRET": get_random_secret(),
        "ENVIRONMENT_VARIABLES_ENCRYPTION_KEY": get_random_secret(32),
        "DATASOURCES_ENCRYPTION_KEY": get_random_secret(32),
        "WORKSPACE_SECRETS_ENCRYPTION_KEY": get_random_secret(32),
    }

    # override config with env vars
    for k, _ in cfg.items():
        if k in os.environ:
            cfg[k] = os.environ[k]

    with open(fpath, "w") as f:
        json.dump(cfg, f, indent=4)
    os.chown(fpath, pwd.getpwnam("briefer").pw_uid, grp.getgrnam("briefer").gr_gid)
    os.chmod(fpath, 0o700)

    return cfg


def setup_apps():
    config_path = get_config_path(APPS_CONFIG_DIR)
    is_first_run = not config_path.exists()
    if is_first_run:
        logging.info("First run, generating apps config")
        cfg = generate_apps_config()
    else:
        logging.info("Apps config exists, loading")
        cfg = get_config(APPS_CONFIG_DIR)

    logging.info("Setting up postgres")
    while True:
        try:
            with psycopg2.connect(user="briefer", password="briefer", host="localhost", port="5432") as conn:
                break
        except:
            logging.info("Waiting for postgres to be ready")
            time.sleep(0.3)
            continue
    with psycopg2.connect(user="briefer", password="briefer", host="localhost", port="5432") as conn:
        logging.info("Postgres is ready")
        logging.info("Changing default user password")
        cur = conn.cursor()
        cur.execute(f"ALTER USER briefer WITH PASSWORD '{cfg['POSTGRES_PASSWORD']}'")
        conn.commit()
        logging.info("Password changed")


    run_migrations(cfg)

    return cfg

def generate_jupyter_config():
    fpath = get_config_path(JUPYTER_CONFIG_DIR)
    apps_cfg = get_config(APPS_CONFIG_DIR)
    cfg = {
        "JUPYTER_TOKEN": apps_cfg["JUPYTER_TOKEN"],
    }
    with open(fpath, "w") as f:
        json.dump(cfg, f, indent=4)
    os.chown(fpath, pwd.getpwnam("jupyteruser").pw_uid, grp.getgrnam("jupyteruser").gr_gid)
    os.chmod(fpath, 0o700)

def setup_jupyter():
    generate_jupyter_config()

def run_migrations(cfg):
    logging.info("Running migrations")

    username = cfg["POSTGRES_USERNAME"]
    password = cfg["POSTGRES_PASSWORD"]
    default_env = {
        "NODE_ENV": "production",
        "POSTGRES_PRISMA_URL": f"postgresql://{username}:{password}@localhost:5432/briefer?schema=public"
    }

    env = os.environ.copy()
    for k, v in default_env.items():
        if k not in env:
            env[k] = v

    migrations = subprocess.run(
        ["npx", "prisma", "migrate", "deploy", "--schema", "packages/database/prisma/schema.prisma"],
        env=env,
        cwd="/app/api/"
    )
    migrations.check_returncode()

    logging.info("Migrations done")


def main():
    logging.basicConfig(level=logging.INFO)
    logging.info("Starting setup")

    # create an empty file to signal that setup is running
    setups = [(APPS_CONFIG_DIR, "briefer"), (JUPYTER_CONFIG_DIR, "jupyteruser")]
    for dir, user in setups:
        os.makedirs(dir, exist_ok=True)
        path = Path(dir, "setup")
        path.touch()
        os.chown(path, pwd.getpwnam(user).pw_uid, grp.getgrnam(user).gr_gid)

    setup_apps()
    setup_jupyter()

    for path, user in setups:
        Path(path, "setup").unlink()

    logging.info("Setup finished")

if __name__ == '__main__':
    main()

