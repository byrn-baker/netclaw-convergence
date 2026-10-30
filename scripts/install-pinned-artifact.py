#!/usr/bin/env python3
"""Install a checksum-pinned component binary without invoking it or devices."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import stat
import sys
import tempfile
import urllib.request

ROOT = Path(__file__).resolve().parents[1]


def artifact_for(component, system=None, machine=None):
    system = (system or platform.system()).lower()
    machine = (machine or platform.machine()).lower()
    machine = {"aarch64": "arm64", "amd64": "x86_64", "x64": "x86_64"}.get(machine, machine)
    manifest = json.loads((ROOT / 'tests/contract-suites.json').read_text())
    # The existing manifest is the reviewed source of binary pins.
    suites = manifest['suites']
    entries = [suites.get(component, {})] if isinstance(suites, dict) else [s for s in suites if s.get('id') == component]
    for suite in entries:
        for artifact in suite.get('artifacts', []):
            if artifact['platform'] == f'{system}-{machine}':
                return artifact
    raise ValueError('No qualified binary for this platform')


def install(artifact, destination, opener=urllib.request.urlopen):
    destination = Path(os.path.abspath(destination))
    for ancestor in reversed([destination.parent, *destination.parent.parents]):
        if ancestor.is_symlink() or (ancestor.exists() and not ancestor.is_dir()):
            raise ValueError('Unsafe destination ancestor')
    if destination.is_symlink() or (destination.exists() and not destination.is_file()):
        raise ValueError('Unsafe destination')
    if destination.exists():
        if hashlib.sha256(destination.read_bytes()).hexdigest() == artifact['sha256']:
            return 'already_verified'
        # Never replace an unrecognized binary on a shared legacy checkout.
        raise ValueError('Existing binary differs from the selected pin; choose a fresh destination')
    destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd, temporary = tempfile.mkstemp(prefix='.artifact-', dir=destination.parent)
    try:
        digest = hashlib.sha256()
        size = 0
        with os.fdopen(fd, 'wb') as output, opener(artifact['url'], timeout=60) as response:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > 256 * 1024 * 1024:
                    raise ValueError('Artifact exceeds size limit')
                digest.update(chunk)
                output.write(chunk)
            output.flush()
            os.fsync(output.fileno())
        if digest.hexdigest() != artifact['sha256']:
            raise ValueError('Artifact checksum mismatch')
        os.chmod(temporary, 0o700)
        # Hard-link is atomic and refuses a destination that appeared meanwhile.
        os.link(temporary, destination, follow_symlinks=False)
        return 'installed_verified'
    finally:
        Path(temporary).unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('component', choices=['k8s'])
    parser.add_argument('--destination', required=True)
    args = parser.parse_args()
    try:
        print(install(artifact_for(args.component), args.destination))
        return 0
    except Exception:
        # HTTP errors can include private proxy/credential URLs; never echo them.
        print('Pinned artifact installation failed; check platform, destination and trusted download access.', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
