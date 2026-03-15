import argparse
import os
from pathlib import Path

import paramiko


def ensure_remote_dir(sftp: paramiko.SFTPClient, remote_path: str) -> None:
    parts = []
    current = remote_path
    while current not in ("", "/"):
        parts.append(current)
        current = os.path.dirname(current)
    for path in reversed(parts):
        try:
            sftp.stat(path)
        except FileNotFoundError:
            sftp.mkdir(path)


def upload_dir(sftp: paramiko.SFTPClient, local_dir: Path, remote_dir: str) -> None:
    ensure_remote_dir(sftp, remote_dir)
    for item in local_dir.iterdir():
        remote_path = f"{remote_dir}/{item.name}"
        if item.is_dir():
            upload_dir(sftp, item, remote_path)
        else:
            sftp.put(str(item), remote_path)


def upload_file(sftp: paramiko.SFTPClient, local_file: Path, remote_file: str) -> None:
    ensure_remote_dir(sftp, os.path.dirname(remote_file))
    sftp.put(str(local_file), remote_file)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", required=True)
    parser.add_argument("--user", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--local", required=True)
    parser.add_argument("--remote", required=True)
    args = parser.parse_args()

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
    sftp = client.open_sftp()

    local_path = Path(args.local)
    if local_path.is_dir():
        upload_dir(sftp, local_path, args.remote)
    else:
        upload_file(sftp, local_path, args.remote)

    sftp.close()
    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
