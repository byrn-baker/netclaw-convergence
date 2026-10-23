#!/usr/bin/env python3
"""Migrate remote HUD access to an authenticated, loopback-only SSH tunnel.

Preview is the default. No configuration, credentials, or user data is modified.
Use --connect to hold the tunnel open; Ctrl-C closes it. SSH verifies host keys
normally and prompts through its own terminal if authentication is needed.
"""
from __future__ import annotations
import argparse
import re
import shlex
import shutil
import subprocess


def tcp_port(value: str) -> int:
    if not value.isdecimal() or not 1 <= int(value) <= 65535:
        raise argparse.ArgumentTypeError("port must be between 1 and 65535")
    return int(value)


def ssh_target(value: str) -> str:
    # SSH configuration aliases and DNS/IPv4 names, optionally with user@.
    # Exclude whitespace, leading options and shell metacharacters even though
    # execution uses argv, never a shell. IPv6 hosts can use an SSH config alias.
    if not re.fullmatch(r"(?:[A-Za-z0-9_][A-Za-z0-9_.-]*@)?[A-Za-z0-9][A-Za-z0-9_.-]*", value):
        raise argparse.ArgumentTypeError("use a hostname or SSH alias, optionally user@host")
    return value


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--ssh-target', required=True, type=ssh_target)
    p.add_argument('--ui-port', type=tcp_port, default=3000, help='same local/remote HUD_UI_PORT (default 3000)')
    p.add_argument('--api-port', type=tcp_port, default=3001, help='same local/remote HUD_PORT (default 3001)')
    p.add_argument('--connect', action='store_true', help='open the tunnel; otherwise preview only')
    return p


def tunnel_command(target: str, ui_port: int, api_port: int) -> list[str]:
    return ['ssh', '-N', '-T', '-a', '-o', 'ExitOnForwardFailure=yes',
            '-o', 'StrictHostKeyChecking=ask', '-o', 'ServerAliveInterval=30',
            '-L', f'127.0.0.1:{ui_port}:127.0.0.1:{ui_port}',
            '-L', f'127.0.0.1:{api_port}:127.0.0.1:{api_port}', target]


def main(argv: list[str] | None = None) -> int:
    p = parser()
    args = p.parse_args(argv)
    if args.ui_port == args.api_port:
        p.error('--ui-port and --api-port must differ')
    command = tunnel_command(args.ssh_target, args.ui_port, args.api_port)
    print('No files or application state will be changed. Close the tunnel to undo access.')
    print(shlex.join(command))
    print(f'Open http://127.0.0.1:{args.ui_port} (canvas chat: /canvas.html).')
    if not args.connect:
        print('Preview only. Add --connect to authenticate with SSH and open the tunnel.')
        return 0
    if not shutil.which('ssh'):
        p.error('ssh is required; install an OpenSSH client first')
    try:
        return subprocess.call(command)
    except KeyboardInterrupt:
        return 130
    except OSError as exc:
        print(f'Could not start SSH: {exc}')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
