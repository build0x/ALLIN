import argparse
from pathlib import Path

import paramiko


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", required=True)
    parser.add_argument("--user", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--script", required=True)
    args = parser.parse_args()

    script = Path(args.script).read_text(encoding="utf-8")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        hostname=args.host,
        username=args.user,
        password=args.password,
        timeout=20,
        look_for_keys=False,
        allow_agent=False,
        auth_timeout=20,
    )

    stdin, stdout, stderr = client.exec_command(script, get_pty=True)
    print(stdout.read().decode("utf-8", "ignore"))
    print(stderr.read().decode("utf-8", "ignore"))
    status = stdout.channel.recv_exit_status()
    client.close()
    return status


if __name__ == "__main__":
    raise SystemExit(main())
