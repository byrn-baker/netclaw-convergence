#!/usr/bin/env python3
"""Preview/apply/restore the pyATS HTTP launcher environment migration."""
import argparse
import importlib.util
from pathlib import Path
import os
import shlex

_spec = importlib.util.spec_from_file_location('voice_migration', Path(__file__).with_name('migrate-voice-auth.py'))
_helpers = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_helpers)


def migrate(path, root, venv, apply=False, restore=False, upstream=None):
    path, root, venv = (Path(p).absolute() for p in (path, root, venv))
    # Managed-source adoption is a separate migration from the original HTTP
    # bridge. Preserve that earlier recovery point on an existing installation.
    backup = path.with_name(path.name + ('.pre-pyats-managed' if upstream else '.pre-pyats-http'))
    _helpers.regular_file(path)
    _helpers.regular_file(backup)
    original = path.read_bytes() if path.exists() else b''
    if restore:
        if not backup.is_file(): raise ValueError('No migration backup')
        _helpers.restore_backup(path, backup, apply)
        print('Restored environment.' if apply else 'Preview: restore environment backup.')
        return
    updates = {'PYATS_MCP_SCRIPT': str(root/'scripts/pyats-stdio.py'),
               'PYATS_UPSTREAM_SCRIPT': str(Path(upstream).absolute() if upstream else root/'mcp-servers/pyATS_MCP/pyats_mcp_server.py'),
               'PYATS_VENV': str(venv)}
    if any('\n' in v or '\r' in v for v in updates.values()):raise ValueError('Invalid path')
    if not apply:
        print('Preview: set ' + ', '.join(updates) + '; preserve testbed and unrelated settings; private backup before writes.')
        return
    if not all(Path(p).is_file() for p in (updates['PYATS_MCP_SCRIPT'], updates['PYATS_UPSTREAM_SCRIPT'], str(venv/'bin/python'))):
        raise ValueError('Install pyATS HTTP runtime before migration')
    text = original.decode()
    current = _helpers.values(text)
    if all(current.get(k) == v for k,v in updates.items()):
        os.chmod(path,0o600)
        print('Already migrated; unchanged.')
        return
    lines = [line for line in text.splitlines(keepends=True) if not ((m := _helpers.ASSIGNMENT.match(line.strip())) and m[1] in updates)]
    updated = ''.join(lines).rstrip('\n')+'\n' + ''.join(k+'='+_helpers.quote(v)+'\n' for k,v in updates.items())
    if path.exists():
        fd=os.open(backup,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
        with os.fdopen(fd,'wb') as stream:
            stream.write(original);stream.flush();os.fsync(stream.fileno())
    _helpers.write_migrated(path, updated.encode(), backup)
    print('Migrated; reload the runtime environment. Testbed untouched. Backup retained.')


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--env-file',default=str(Path.home()/'.openclaw/.env'))
    ap.add_argument('--repo',default=str(Path(__file__).resolve().parents[1]))
    ap.add_argument('--venv',default=str(Path.home()/'.openclaw/pyats-venv'))
    ap.add_argument('--upstream',help='Explicit verified managed server script; legacy repo path remains the default')
    ap.add_argument('--apply',action='store_true');ap.add_argument('--restore',action='store_true')
    args=ap.parse_args()
    try:migrate(args.env_file,args.repo,args.venv,args.apply,args.restore,args.upstream)
    except (OSError,ValueError):
        print('Migration stopped; check paths, installed runtime and existing backup. No secret values printed.')
        return 1
    return 0


if __name__=='__main__':raise SystemExit(main())
