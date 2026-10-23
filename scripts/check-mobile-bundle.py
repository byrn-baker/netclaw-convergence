#!/usr/bin/env python3
"""Check actual iOS/watch app and extension metadata before release export."""
import argparse
import json
from pathlib import Path
import plistlib


def inspect(root):
    root = Path(root)
    paths = [root] + sorted(p for p in root.rglob('*') if p.is_dir() and p.suffix in ('.app', '.appex'))
    records, errors, identifiers = [], [], set()
    for path in paths:
        try:
            data = plistlib.loads((path/'Info.plist').read_bytes())
        except (OSError, ValueError, plistlib.InvalidFileException):
            errors.append(f'{path.name}: missing or invalid Info.plist')
            continue
        bundle_id = data.get('CFBundleIdentifier')
        version = data.get('CFBundleShortVersionString')
        build = data.get('CFBundleVersion')
        records.append({'bundle': path.name, 'identifier': bundle_id, 'version': version, 'build': build})
        if not all(isinstance(v, str) and v for v in (bundle_id, version, build)):
            errors.append(f'{path.name}: missing identifier/version/build')
        if bundle_id in identifiers:
            errors.append(f'{path.name}: duplicate bundle identifier')
        identifiers.add(bundle_id)
        if records and (version, build) != (records[0]['version'], records[0]['build']):
            errors.append(f'{path.name}: version/build differs from containing app')
    return {'bundles': records, 'errors': errors}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('app', type=Path)
    result = inspect(parser.parse_args().app)
    print(json.dumps(result, indent=2))
    raise SystemExit(bool(result['errors']))
