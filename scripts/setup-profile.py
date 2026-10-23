#!/usr/bin/env python3
"""Preserve operator profile/voice state during interactive platform setup."""
import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys

_spec = importlib.util.spec_from_file_location('setup_writer', Path(__file__).with_name('write-env.py'))
_writer = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_writer)
START = '<!-- netclaw-setup-identity:start -->'
END = '<!-- netclaw-setup-identity:end -->'


def save(path, text):
    path = Path(path)
    if path.is_symlink():
        raise ValueError('Refusing symlink configuration')
    if path.exists():
        old = path.read_bytes().decode('utf-8')
        if old == text:
            return
        backup = path.parent / '.setup-backups' / (path.name + '.' + hashlib.sha256(old.encode()).hexdigest())
        if backup.parent.is_symlink():
            raise ValueError('Refusing linked recovery directory')
        if backup.exists():
            if backup.is_symlink() or backup.read_text() != old:
                raise ValueError('Existing recovery copy conflicts')
        else:
            _writer.write_private(backup, old)
    _writer.write_private(path, text)


def identity(path, name, role, zone):
    path = Path(path)
    old = path.read_bytes().decode('utf-8') if path.exists() else '# About My Human\n'
    block = START + '\n## Setup identity\n' + '\n'.join(
        f'- **{label}:** {value}' for label, value in [('Name',name),('Role',role),('Timezone',zone)] if value) + '\n' + END
    if START in old or END in old:
        if old.count(START) != 1 or old.count(END) != 1 or old.index(END) < old.index(START):
            raise ValueError('Malformed managed identity section; preserve and review manually')
        new = old[:old.index(START)] + block + old[old.index(END)+len(END):]
    else:
        new = old + ('\n' if old.endswith('\n') else '\n\n') + block + '\n'
    save(path, new)


def voice(path, phone, label, template):
    path = Path(path)
    if not re.fullmatch(r'\+[1-9][0-9]{7,14}', phone):
        raise ValueError('Phone must use E.164 format')
    data = json.loads(path.read_text() if path.exists() else Path(template).read_text())
    if not isinstance(data, dict) or not isinstance(data.get('whitelist'), list) or not all(isinstance(e, dict) for e in data['whitelist']):
        raise ValueError('Invalid existing whitelist; preserve and review manually')
    if not path.exists():
        data['whitelist'] = []  # Never activate the example phone number.
    existing = next((e for e in data['whitelist'] if e.get('phone_number') == phone), None)
    if existing is not None:
        existing['label'] = label
    else:
        data['whitelist'].append({'phone_number':phone,'label':label,'can_receive_calls':True,
                                  'can_initiate_calls':True,'added_at':datetime.now(timezone.utc).isoformat(),
                                  'added_by':'setup.sh'})
    save(path, json.dumps(data, indent=2)+'\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('kind', choices=['identity','voice'])
    parser.add_argument('path', type=Path)
    parser.add_argument('--template', type=Path)
    args = parser.parse_args()
    fields = sys.stdin.read().split('\0')
    if fields and fields[-1] == '': fields.pop()
    try:
        if any('\n' in f or '\r' in f or START in f or END in f for f in fields):
            raise ValueError('Setup fields must be single-line text without managed markers')
        if args.kind == 'identity' and len(fields) == 3:
            identity(args.path, *fields)
        elif args.kind == 'voice' and len(fields) == 2 and args.template:
            voice(args.path, *fields, args.template)
        else:
            raise ValueError('Wrong setup field count or missing template')
    except (OSError, ValueError) as exc:
        parser.exit(1, f'Setup update refused: {type(exc).__name__}; existing files retained.\n')


if __name__ == '__main__': main()
