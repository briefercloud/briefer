import docker
import sys
import socket
import argparse

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

def start_or_run_container(client, container_name, image, detach):
    # Check if the ports 3000 and 8080 are available
    if is_port_in_use(3000):
        print("Error: Port 3000 is already in use. Please stop the service using this port before starting Briefer.", file=sys.stderr)
        sys.exit(1)

    if is_port_in_use(8080):
        print("Error: Port 8080 is already in use. Please stop the service using this port before starting Briefer.", file=sys.stderr)
        sys.exit(1)

    if is_container_existing(client, container_name):
        container = client.containers.get(container_name)
        container.start()
    else:
        volumes = {
            'briefer_psql_data': {'bind': '/var/lib/postgresql/data', 'mode': 'rw'},
            'briefer_jupyter_data': {'bind': '/home/jupyteruser', 'mode': 'rw'},
            'briefer_briefer_data': {'bind': '/home/briefer', 'mode': 'rw'}
        }
        print('Starting Briefer...')
        container = client.containers.run(
            image,
            detach=True,
            ports={'3000/tcp': 3000, '8080/tcp': 8080},
            name=container_name,
            volumes=volumes
        )

    if not detach:
        attach(container)

def attach(container):
    for stdout, stderr in container.attach(stream=True, stdout=True, stderr=True, demux=True):
        if stdout:
            sys.stdout.buffer.write(stdout)
            sys.stdout.flush()
        if stderr:
            sys.stderr.buffer.write(stderr)
            sys.stderr.flush()

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

    # start or run the container
    start_or_run_container(client, container_name, args.image, args.detach)

if __name__ == "__main__":
    main()
