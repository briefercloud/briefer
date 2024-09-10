import argparse
import docker
import os
import requests
import signal
import socket
import sys
import threading
import time
import webbrowser

ENV_VARS = [
    "LOG_LEVEL",
    "API_URL",
    "FRONTEND_URL",
    "TLD",
    "LOGIN_JWT_SECRET",
    "AUTH_JWT_SECRET",
    "AI_API_URL",
    "AI_API_USERNAME",
    "AI_API_PASSWORD",
    "PYTHON_ALLOWED_LIBRARIES",
    "POSTGRES_USERNAME",
    "POSTGRES_PASSWORD",
    "POSTGRES_HOSTNAME",
    "POSTGRES_PORT",
    "POSTGRES_DATABASE",
    "ENVIRONMENT_VARIABLES_ENCRYPTION_KEY",
    "WORKSPACE_SECRETS_ENCRYPTION_KEY",
    "DATASOURCES_ENCRYPTION_KEY",
    "JUPYTER_HOST",
    "JUPYTER_PORT",
    "JUPYTER_TOKEN"
]

def check_docker_running():
    client = docker.from_env()
    try:
        client.ping()
        return client
    except docker.errors.APIError:
        print("Error: Docker is not running.", file=sys.stderr)
        sys.exit(1)


def is_container_running(client, container_name):
    try:
        container = client.containers.get(container_name)
        return container.status == "running"
    except docker.errors.NotFound:
        return False


def is_container_existing(client, container_name):
    try:
        client.containers.get(container_name)
        return True
    except docker.errors.NotFound:
        return False


def create_volume_if_not_exists(client, volume_name):
    if volume_name not in [v.name for v in client.volumes.list()]:
        client.volumes.create(name=volume_name)


def handle_existing_container(client, container_name, detach):
    print('Error: Briefer is already running.', file=sys.stderr)
    action = input('Do you want to stop or restart it?\nPress enter to leave it running.\n[stop/restart]: ').strip()

    container = client.containers.get(container_name)

    if action == "stop":
        print('Stopping Briefer...')
        container.stop()
        print('Briefer stopped.')
        sys.exit(0)

    elif action == "restart":
        print('Restarting Briefer...')
        container.restart()
        if not detach:
            attach(container)
        sys.exit(0)

    elif action != "":
        print('Error: invalid action.', file=sys.stderr)
        sys.exit(1)


def is_port_in_use(port):
    """Check if a port is in use by attempting to bind to it."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("0.0.0.0", port))
            return False
        except OSError:
            return True


def find_free_port(start_port):
    while is_port_in_use(start_port):
        start_port += 1
    return start_port

def start_or_run_container(client, container_name, image, detach):
    if ":" not in image and "/" in image:
        image += ":latest"

    web_port = find_free_port(3000)
    api_port = find_free_port(8080)

    if "/" in image and "latest" in image or not client.images.list(name=image):
        pull_image(client, image)

    # If the container exists, remove it to allow new port mappings and env variables
    if is_container_existing(client, container_name):
        container = client.containers.get(container_name)
        container.stop()
        container.remove()

    # Define the volumes and environment variables
    volumes = {
        'briefer_psql_data': {'bind': '/var/lib/postgresql/data', 'mode': 'rw'},
        'briefer_jupyter_data': {'bind': '/home/jupyteruser', 'mode': 'rw'},
        'briefer_briefer_data': {'bind': '/home/briefer', 'mode': 'rw'}
    }

    env = {}
    for var in ENV_VARS:
        if var in os.environ:
            env[var] = os.environ[var]

    if "API_URL" not in env:
        env["API_URL"] = f"http://localhost:{api_port}"

    if "FRONTEND_URL" not in env:
        env["FRONTEND_URL"] = f"http://localhost:{web_port}"

    # Run a new container with the updated ports and environment
    container = client.containers.run(
        image,
        detach=True,
        ports={f"3000/tcp": web_port, f"8080/tcp": api_port},
        name=container_name,
        volumes=volumes,
        environment=env
    )

    api_url = env["API_URL"]
    web_url = env["FRONTEND_URL"]

    def check_reachability():
        while True:
            try:
                response = requests.get(f"{api_url}/readyz")
                if response.status_code != 200:
                    time.sleep(1)
                    continue

                response = requests.get(web_url)
                if response.status_code == 200:
                    webbrowser.open(web_url)
                    break
            except requests.ConnectionError:
                pass
            time.sleep(1)

    thread = threading.Thread(target=check_reachability)
    thread.start()

    # Attach to logs so the user can see what's happening
    if not detach:
        attach(container)

    thread.join()


def pull_image(client, image):
    print(f"Downloading image {image}...")
    has_some_version = len(client.images.list(name=image)) > 0
    try:
        client.images.pull(image)
        print(f"Downloaded image {image}.")
    except:
        if has_some_version:
            print(f"Error: failed to download image {image}. Using cached version.", file=sys.stderr)
        else:
            raise


def attach(container):
    for stdout, stderr in container.attach(stream=True, stdout=True, stderr=True, demux=True):
        if stdout:
            sys.stdout.buffer.write(stdout)
            sys.stdout.flush()
        if stderr:
            sys.stderr.buffer.write(stderr)
            sys.stderr.flush()


def signal_handler(sig, frame, container_name, client):
    print("\nCTRL-C detected. Stopping Briefer...")
    container = client.containers.get(container_name)
    container.stop()
    print("Briefer stopped.")
    sys.exit(0)


def main():
    # Argument parser
    parser = argparse.ArgumentParser(description="Run and manage Briefer.")
    parser.add_argument("-d", "--detach", action="store_true", help="Run Briefer in detached mode")
    parser.add_argument("--image", type=str, default="briefercloud/briefer", help=argparse.SUPPRESS)
    
    args = parser.parse_args()

    # initialize docker client and check if Docker is running
    client = check_docker_running()

    container_name = "briefer"

    # if container is already running, handle user input
    if is_container_running(client, container_name):
        handle_existing_container(client, container_name, args.detach)
        return

    # check or create necessary volumes
    create_volume_if_not_exists(client, "briefer_psql_data")
    create_volume_if_not_exists(client, "briefer_jupyter_data")
    create_volume_if_not_exists(client, "briefer_briefer_data")

    # Register signal handler for CTRL-C
    signal.signal(signal.SIGINT, lambda sig, frame: signal_handler(sig, frame, container_name, client))

    # start or run the container
    start_or_run_container(client, container_name, args.image, args.detach)

if __name__ == "__main__":
    main()
