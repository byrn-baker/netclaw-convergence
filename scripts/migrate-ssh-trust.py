#!/usr/bin/env python3
"""Adopt explicit multivendor SSH trust without fetching or trusting remote keys."""
import argparse
import importlib.util
import os
from pathlib import Path

spec = importlib.util.spec_from_file_location('helpers', Path(__file__).with_name('migrate-voice-auth.py'))
helpers = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helpers)


def migrate(path, known_hosts=None, apply=False, restore=False):
    path = Path(path).absolute()
    backup = path.with_name(path.name + '.pre-ssh-trust')
    helpers.regular_file(path)
    helpers.regular_file(backup)
    original = path.read_bytes() if path.exists() else b''
    if restore:
        if not backup.is_file():
            raise ValueError('No backup')
        helpers.restore_backup(path, backup, apply)
        print('Restored environment.' if apply else 'Preview: restore environment backup.')
        return
    current = helpers.values(original.decode())
    trusted = Path(known_hosts or current.get('MULTIVENDOR_KNOWN_HOSTS') or '~/.ssh/known_hosts').expanduser().absolute()
    helpers.regular_file(trusted)
    if not trusted.is_file() or not trusted.read_text().strip():
        raise ValueError('Supply a nonempty, independently verified known_hosts file')
    updates = {'MULTIVENDOR_SSH_STRICT': 'true', 'MULTIVENDOR_KNOWN_HOSTS': str(trusted)}
    print('SSH identity checking enabled; supplied keys must be verified through a trusted channel.')
    print('Junos uses ~/.ssh/known_hosts; import verified keys there separately.')
    if not apply:
        print('Preview only; no environment edits or device requests.')
        return
    if all(current.get(k) == v for k, v in updates.items()):
        path.chmod(0o600)
        print('Already migrated.')
        return
    lines = [line for line in original.decode().splitlines(keepends=True)
             if not ((m := helpers.ASSIGNMENT.match(line.strip())) and m[1] in updates)]
    output = ''.join(lines).rstrip('\n') + '\n' + ''.join(k + '=' + helpers.quote(v) + '\n' for k, v in updates.items())
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    if path.exists():
        fd = os.open(backup, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'wb') as stream:
            stream.write(original)
            stream.flush()
            os.fsync(stream.fileno())
    helpers.write_migrated(path, output.encode(), backup)
    print('Migrated; restart multivendor MCP. No host keys learned automatically.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--env-file', default=str(Path.home() / '.openclaw/.env'))
    parser.add_argument('--known-hosts')
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--restore', action='store_true')
    args = parser.parse_args()
    try:
        migrate(args.env_file, args.known_hosts, args.apply, args.restore)
    except (OSError, ValueError):
        print('Migration stopped; check environment, trusted host-key file and backup. No secrets printed.')
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
