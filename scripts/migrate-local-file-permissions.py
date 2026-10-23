#!/usr/bin/env python3
"""Preview/private-mode migration for local credential/configuration files."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import stat


def inspect_file(path):
    state = path.lstat()
    if not stat.S_ISREG(state.st_mode) or state.st_uid != os.getuid() or state.st_nlink != 1:
        raise ValueError('Target must be an owned regular file without additional hard links')
    return {'path': str(path.absolute()), 'mode': stat.S_IMODE(state.st_mode),
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}


def set_mode(record, mode):
    fd = os.open(record['path'], os.O_RDONLY | os.O_NOFOLLOW)
    try:
        state = os.fstat(fd)
        if state.st_uid != os.getuid() or state.st_nlink != 1 or not stat.S_ISREG(state.st_mode):
            raise ValueError('Target ownership changed')
        with os.fdopen(os.dup(fd), 'rb') as stream:
            if hashlib.sha256(stream.read()).hexdigest() != record['sha256']:
                raise ValueError('Target contents changed')
        os.fchmod(fd, mode)
    finally:
        os.close(fd)


def migrate(paths, journal, apply=False, restore=False):
    journal = Path(journal).absolute()
    if journal.is_symlink():
        raise ValueError('Journal must not be a symlink')
    if restore:
        data = json.loads(journal.read_text())
        if data.get('schema') != 1 or not isinstance(data.get('files'), list):
            raise ValueError('Invalid journal')
        records = data['files']
        for record in records:
            current = inspect_file(Path(record['path']))
            if current['sha256'] != record['sha256'] or current['mode'] not in (0o600, record['mode']):
                raise ValueError('File changed after migration; restore refused')
        print(f'Validated restoration for {len(records)} files; no contents will change.')
        if apply:
            for record in records:
                set_mode(record, record['mode'])
        return
    records = [inspect_file(Path(path).absolute()) for path in paths if Path(path).exists() or Path(path).is_symlink()]
    changed = [record for record in records if record['mode'] != 0o600]
    print(f'{len(records)} existing files checked; {len(changed)} require mode0600.')
    if not apply or not changed:
        return
    journal.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd = os.open(journal, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'w') as stream:
        json.dump({'schema':1, 'files':changed}, stream)
        stream.flush(); os.fsync(stream.fileno())
    completed = []
    try:
        for record in changed:
            set_mode(record, 0o600)
            completed.append(record)
    except Exception:
        for record in reversed(completed):
            set_mode(record, record['mode'])
        raise
    print('Private modes applied; original modes and digests retained in the journal.')


def main():
    root = Path(__file__).resolve().parents[1]
    home = Path.home() / '.openclaw'
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--path', action='append', help='Override default target set; may repeat')
    parser.add_argument('--journal', default=str(home / 'local-permissions-backup.json'))
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--restore', action='store_true')
    args = parser.parse_args()
    paths = args.path or [home / '.env', home / 'openclaw.json', root / '.env', root / 'testbed/testbed.yaml']
    try:
        migrate(paths, args.journal, args.apply, args.restore)
    except (OSError, ValueError, KeyError, TypeError):
        print('Stopped: inspect ownership, links, prior journal or later file changes. No secret values printed.')
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
