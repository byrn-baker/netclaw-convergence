#!/usr/bin/env python3
"""Deploy managed skill files with retained originals and guarded recovery."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import tempfile


def digest(data):
    return hashlib.sha256(data).hexdigest()


def no_links(path):
    for item in (path, *path.parents):
        if item.is_symlink():
            raise ValueError(f'refusing symlink: {item}')


def atomic(path, data, mode=0o600):
    no_links(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix='.skill-', dir=path.parent)
    try:
        with os.fdopen(fd, 'wb') as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(name, mode)
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def deploy(source, destination, backups, state_base='.openclaw', preview=False):
    source, destination, backups = map(lambda p: Path(p).absolute(), (source, destination, backups))
    no_links(source)
    no_links(destination)
    no_links(backups)
    if not source.is_dir():
        raise ValueError(f'source directory unavailable: {source}')
    pending = []
    for item in sorted(source.rglob('*')):
        no_links(item)
        relative = item.relative_to(source)
        target = destination / relative
        no_links(target)
        if item.is_dir():
            if target.exists() and not target.is_dir():
                raise ValueError(f'directory conflicts with file: {target}')
            continue
        if not item.is_file():
            raise ValueError(f'not a regular source file: {item}')
        if target.exists() and not target.is_file():
            raise ValueError(f'not a regular destination file: {target}')
        data = item.read_bytes()
        if state_base != '.openclaw' and item.suffix in {'.md', '.py', '.js', '.css'}:
            data = data.replace(b'.openclaw', state_base.encode())
        old = target.read_bytes() if target.exists() else None
        if old != data:
            pending.append((relative, target, data, old, item.stat().st_mode & 0o777))
    if preview:
        return len(pending)
    if not pending:
        return None
    backups.mkdir(parents=True, exist_ok=True, mode=0o700)
    generation = Path(tempfile.mkdtemp(prefix='deploy-', dir=backups))
    entries = []
    for relative, target, data, old, mode in pending:
        entry = {'path': str(relative), 'after': digest(data), 'before': digest(old) if old is not None else None,
                 'mode': target.stat().st_mode & 0o777 if old is not None else None}
        if old is not None:
            atomic(generation / 'originals' / relative, old)
        entries.append(entry)
    # Save all originals and the intended after-state before replacing anything.
    atomic(generation / 'journal.json', json.dumps({'destination': str(destination), 'entries': entries}, indent=2).encode())
    for relative, target, data, old, mode in pending:
        atomic(target, data, mode)
    return generation


def restore(generation):
    generation = Path(generation).absolute()
    no_links(generation)
    journal = json.loads((generation / 'journal.json').read_text())
    destination = Path(journal['destination'])
    pending = []
    for entry in journal['entries']:
        relative = Path(entry['path'])
        if relative.is_absolute() or '..' in relative.parts:
            raise ValueError('unsafe recovery path')
        target = destination / relative
        no_links(target)
        current = digest(target.read_bytes()) if target.exists() else None
        if current == entry['before']:
            continue
        if current != entry['after']:
            raise ValueError(f'recovery conflict: {target}')
        original = generation / 'originals' / relative
        no_links(original)
        old = original.read_bytes() if entry['before'] is not None else None
        if old is not None and digest(old) != entry['before']:
            raise ValueError(f'backup digest mismatch: {original}')
        pending.append((target, old, entry['mode']))
    for target, old, mode in pending:
        if old is None:
            target.unlink()
        else:
            atomic(target, old, mode)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path)
    parser.add_argument('--destination', type=Path)
    parser.add_argument('--backups', type=Path)
    parser.add_argument('--state-base', default='.openclaw')
    parser.add_argument('--restore', type=Path)
    parser.add_argument('--preview', action='store_true')
    args = parser.parse_args()
    try:
        if args.restore:
            if args.preview:
                parser.error('--preview applies to deployment, not restore')
            restore(args.restore)
            print('Skill originals restored; recovery journal retained.')
        else:
            if not all((args.source, args.destination, args.backups)):
                parser.error('--source, --destination and --backups are required')
            result = deploy(args.source, args.destination, args.backups, args.state_base, args.preview)
            if args.preview:
                print(f'Preview: {result} files would change; no files written.')
            else:
                print(f'Skills deployed; recovery: {result}' if result else 'Skills unchanged.')
    except (OSError, ValueError) as exc:
        parser.exit(1, f'Skill deployment failed: {exc}\n')


if __name__ == '__main__':
    main()
