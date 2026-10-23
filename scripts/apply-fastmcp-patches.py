#!/usr/bin/env python3
"""Apply reviewed external FastMCP migrations; refuse drift and operator edits.

No package installation or network access. All files are verified before any write.
Already migrated files are accepted; unknown source is never rewritten speculatively.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import os
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def digest(text):
    return hashlib.sha256(text.encode()).hexdigest()


def prepare(root, component, manifest):
    entry = manifest['components'].get(component)
    if entry is None:
        return []
    base = root / 'mcp-servers' / entry['directory']
    if not base.is_dir() or base.is_symlink():
        raise ValueError(f'{component}: expected a real source directory: {base}')
    changes = []
    for patch in entry['patches']:
        path = base / patch['path']
        if not path.resolve().is_relative_to(base.resolve()) or path.is_symlink():
            raise ValueError(f'{component}: unsafe patch path: {patch["path"]}')
        source = path.read_text()
        if digest(source) == patch['after_sha256']:
            continue
        candidates = [patch, *patch.get('variants', [])]
        selected = next((p for p in candidates if digest(source) == p['before_sha256']), None)
        if selected is None:
            raise ValueError(f'{component}: unreviewed upstream/operator changes in {patch["path"]}; '
                             'refresh the compatibility patch before installing')
        updated = source
        for edit in reversed(selected['edits']):
            start = edit['start']
            end = start + len(edit['old'])
            if updated[start:end] != edit['old']:
                raise ValueError(f'{component}: invalid patch in {patch["path"]}')
            updated = updated[:start] + edit['new'] + updated[end:]
        if digest(updated) != patch['after_sha256']:
            raise ValueError(f'{component}: patch result hash mismatch: {patch["path"]}')
        changes.append((path, source, updated))
    return changes


def write_atomic(path, text):
    fd, name = tempfile.mkstemp(prefix='.netclaw-fastmcp-', dir=path.parent)
    try:
        with os.fdopen(fd, 'w') as stream:
            stream.write(text)
        os.chmod(name, path.stat().st_mode & 0o777)
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def apply(root, component, manifest, check=False):
    changes = prepare(root, component, manifest)
    if check:
        return len(changes)
    written = []
    try:
        for path, old, new in changes:
            # Recheck immediately before replacement; never overwrite drift.
            if path.read_text() != old:
                raise ValueError(f'Source changed during migration: {path}')
            write_atomic(path, new)
            written.append((path, old, new))
    except BaseException:
        for path, old, new in reversed(written):
            if path.read_text() == new:
                write_atomic(path, old)
        raise
    return len(changes)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--component', required=True)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    manifest = json.loads((ROOT / 'config/fastmcp-external-patches.json').read_text())
    try:
        count = apply(args.root.resolve(), args.component, manifest, args.check)
    except (ValueError, OSError) as exc:
        parser.exit(1, f'FastMCP migration refused: {exc}\n')
    print(f'{args.component}: {count} reviewed files ' + ('ready' if args.check else 'migrated'))


if __name__ == '__main__':
    main()
